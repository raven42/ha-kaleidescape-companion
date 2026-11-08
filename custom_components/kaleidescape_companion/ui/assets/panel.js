const Ae = globalThis, mi = Ae.ShadowRoot && (Ae.ShadyCSS === void 0 || Ae.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, bi = /* @__PURE__ */ Symbol(), Pi = /* @__PURE__ */ new WeakMap();
let ds = class {
  constructor(e, t, i) {
    if (this._$cssResult$ = !0, i !== bi) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o;
    const t = this.t;
    if (mi && e === void 0) {
      const i = t !== void 0 && t.length === 1;
      i && (e = Pi.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), i && Pi.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const Ms = (n) => new ds(typeof n == "string" ? n : n + "", void 0, bi), C = (n, ...e) => {
  const t = n.length === 1 ? n[0] : e.reduce((i, s, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[r + 1], n[0]);
  return new ds(t, n, bi);
}, Bs = (n, e) => {
  if (mi) n.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (const t of e) {
    const i = document.createElement("style"), s = Ae.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = t.cssText, n.appendChild(i);
  }
}, Ui = mi ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (const i of e.cssRules) t += i.cssText;
  return Ms(t);
})(n) : n;
const { is: Is, defineProperty: Os, getOwnPropertyDescriptor: Ns, getOwnPropertyNames: Fs, getOwnPropertySymbols: Vs, getPrototypeOf: Qs } = Object, bt = globalThis, Ti = bt.trustedTypes, Js = Ti ? Ti.emptyScript : "", Hs = bt.reactiveElementPolyfillSupport, ge = (n, e) => n, Rt = { toAttribute(n, e) {
  switch (e) {
    case Boolean:
      n = n ? Js : null;
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
} }, cs = (n, e) => !Is(n, e), Di = { attribute: !0, type: String, converter: Rt, reflect: !1, useDefault: !1, hasChanged: cs };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), bt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let Z = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Di) {
    if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
      const i = /* @__PURE__ */ Symbol(), s = this.getPropertyDescriptor(e, i, t);
      s !== void 0 && Os(this.prototype, e, s);
    }
  }
  static getPropertyDescriptor(e, t, i) {
    const { get: s, set: r } = Ns(this.prototype, e) ?? { get() {
      return this[t];
    }, set(o) {
      this[t] = o;
    } };
    return { get: s, set(o) {
      const d = s?.call(this);
      r?.call(this, o), this.requestUpdate(e, d, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Di;
  }
  static _$Ei() {
    if (this.hasOwnProperty(ge("elementProperties"))) return;
    const e = Qs(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(ge("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(ge("properties"))) {
      const t = this.properties, i = [...Fs(t), ...Vs(t)];
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
      for (const s of i) t.unshift(Ui(s));
    } else e !== void 0 && t.push(Ui(e));
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
    return Bs(e, this.constructor.elementStyles), e;
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
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : Rt).toAttribute(t, i.type);
      this._$Em = e, r == null ? this.removeAttribute(s) : this.setAttribute(s, r), this._$Em = null;
    }
  }
  _$AK(e, t) {
    const i = this.constructor, s = i._$Eh.get(e);
    if (s !== void 0 && this._$Em !== s) {
      const r = i.getPropertyOptions(s), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : Rt;
      this._$Em = s;
      const d = o.fromAttribute(t, r.type);
      this[s] = d ?? this._$Ej?.get(s) ?? d, this._$Em = null;
    }
  }
  requestUpdate(e, t, i, s = !1, r) {
    if (e !== void 0) {
      const o = this.constructor;
      if (s === !1 && (r = this[e]), i ??= o.getPropertyOptions(e), !((i.hasChanged ?? cs)(r, t) || i.useDefault && i.reflect && r === this._$Ej?.get(e) && !this.hasAttribute(o._$Eu(e, i)))) return;
      this.C(e, t, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: i, reflect: s, wrapped: r }, o) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, o ?? t ?? this[e]), r !== !0 || o !== void 0) || (this._$AL.has(e) || (this.hasUpdated || i || (t = void 0), this._$AL.set(e, t)), s === !0 && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
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
        for (const [s, r] of this._$Ep) this[s] = r;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, r] of i) {
        const { wrapped: o } = r, d = this[s];
        o !== !0 || this._$AL.has(s) || d === void 0 || this.C(s, void 0, r, d);
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
Z.elementStyles = [], Z.shadowRootOptions = { mode: "open" }, Z[ge("elementProperties")] = /* @__PURE__ */ new Map(), Z[ge("finalized")] = /* @__PURE__ */ new Map(), Hs?.({ ReactiveElement: Z }), (bt.reactiveElementVersions ??= []).push("2.1.2");
const vi = globalThis, zi = (n) => n, De = vi.trustedTypes, ji = De ? De.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, hs = "$lit$", N = `lit$${Math.random().toFixed(9).slice(2)}$`, ps = "?" + N, _s = `<${ps}>`, K = document, be = () => K.createComment(""), ve = (n) => n === null || typeof n != "object" && typeof n != "function", yi = Array.isArray, Xs = (n) => yi(n) || typeof n?.[Symbol.iterator] == "function", xt = `[ 	
\f\r]`, ne = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Mi = /-->/g, Bi = />/g, V = RegExp(`>|${xt}(?:([^\\s"'>=/]+)(${xt}*=${xt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Ii = /'/g, Oi = /"/g, us = /^(?:script|style|textarea|title)$/i, gs = (n) => (e, ...t) => ({ _$litType$: n, strings: e, values: t }), a = gs(1), $ = gs(2), z = /* @__PURE__ */ Symbol.for("lit-noChange"), l = /* @__PURE__ */ Symbol.for("lit-nothing"), Ni = /* @__PURE__ */ new WeakMap(), _ = K.createTreeWalker(K, 129);
function fs(n, e) {
  if (!yi(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ji !== void 0 ? ji.createHTML(e) : e;
}
const Ws = (n, e) => {
  const t = n.length - 1, i = [];
  let s, r = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", o = ne;
  for (let d = 0; d < t; d++) {
    const c = n[d];
    let h, u, p = -1, m = 0;
    for (; m < c.length && (o.lastIndex = m, u = o.exec(c), u !== null); ) m = o.lastIndex, o === ne ? u[1] === "!--" ? o = Mi : u[1] !== void 0 ? o = Bi : u[2] !== void 0 ? (us.test(u[2]) && (s = RegExp("</" + u[2], "g")), o = V) : u[3] !== void 0 && (o = V) : o === V ? u[0] === ">" ? (o = s ?? ne, p = -1) : u[1] === void 0 ? p = -2 : (p = o.lastIndex - u[2].length, h = u[1], o = u[3] === void 0 ? V : u[3] === '"' ? Oi : Ii) : o === Oi || o === Ii ? o = V : o === Mi || o === Bi ? o = ne : (o = V, s = void 0);
    const w = o === V && n[d + 1].startsWith("/>") ? " " : "";
    r += o === ne ? c + _s : p >= 0 ? (i.push(h), c.slice(0, p) + hs + c.slice(p) + N + w) : c + N + (p === -2 ? d : w);
  }
  return [fs(n, r + (n[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), i];
};
class ye {
  constructor({ strings: e, _$litType$: t }, i) {
    let s;
    this.parts = [];
    let r = 0, o = 0;
    const d = e.length - 1, c = this.parts, [h, u] = Ws(e, t);
    if (this.el = ye.createElement(h, i), _.currentNode = this.el.content, t === 2 || t === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = _.nextNode()) !== null && c.length < d; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(hs)) {
          const m = u[o++], w = s.getAttribute(p).split(N), A = /([.?@])?(.*)/.exec(m);
          c.push({ type: 1, index: r, name: A[2], strings: w, ctor: A[1] === "." ? Ys : A[1] === "?" ? Gs : A[1] === "@" ? Zs : vt }), s.removeAttribute(p);
        } else p.startsWith(N) && (c.push({ type: 6, index: r }), s.removeAttribute(p));
        if (us.test(s.tagName)) {
          const p = s.textContent.split(N), m = p.length - 1;
          if (m > 0) {
            s.textContent = De ? De.emptyScript : "";
            for (let w = 0; w < m; w++) s.append(p[w], be()), _.nextNode(), c.push({ type: 2, index: ++r });
            s.append(p[m], be());
          }
        }
      } else if (s.nodeType === 8) if (s.data === ps) c.push({ type: 2, index: r });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(N, p + 1)) !== -1; ) c.push({ type: 7, index: r }), p += N.length - 1;
      }
      r++;
    }
  }
  static createElement(e, t) {
    const i = K.createElement("template");
    return i.innerHTML = e, i;
  }
}
function se(n, e, t = n, i) {
  if (e === z) return e;
  let s = i !== void 0 ? t._$Co?.[i] : t._$Cl;
  const r = ve(e) ? void 0 : e._$litDirective$;
  return s?.constructor !== r && (s?._$AO?.(!1), r === void 0 ? s = void 0 : (s = new r(n), s._$AT(n, t, i)), i !== void 0 ? (t._$Co ??= [])[i] = s : t._$Cl = s), s !== void 0 && (e = se(n, s._$AS(n, e.values), s, i)), e;
}
class Ks {
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
    const { el: { content: t }, parts: i } = this._$AD, s = (e?.creationScope ?? K).importNode(t, !0);
    _.currentNode = s;
    let r = _.nextNode(), o = 0, d = 0, c = i[0];
    for (; c !== void 0; ) {
      if (o === c.index) {
        let h;
        c.type === 2 ? h = new ae(r, r.nextSibling, this, e) : c.type === 1 ? h = new c.ctor(r, c.name, c.strings, this, e) : c.type === 6 && (h = new ea(r, this, e)), this._$AV.push(h), c = i[++d];
      }
      o !== c?.index && (r = _.nextNode(), o++);
    }
    return _.currentNode = K, s;
  }
  p(e) {
    let t = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(e, i, t), t += i.strings.length - 2) : i._$AI(e[t])), t++;
  }
}
class ae {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, t, i, s) {
    this.type = 2, this._$AH = l, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
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
    e = se(this, e, t), ve(e) ? e === l || e == null || e === "" ? (this._$AH !== l && this._$AR(), this._$AH = l) : e !== this._$AH && e !== z && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : Xs(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== l && ve(this._$AH) ? this._$AA.nextSibling.data = e : this.T(K.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: t, _$litType$: i } = e, s = typeof i == "number" ? this._$AC(e) : (i.el === void 0 && (i.el = ye.createElement(fs(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(t);
    else {
      const r = new Ks(s, this), o = r.u(this.options);
      r.p(t), this.T(o), this._$AH = r;
    }
  }
  _$AC(e) {
    let t = Ni.get(e.strings);
    return t === void 0 && Ni.set(e.strings, t = new ye(e)), t;
  }
  k(e) {
    yi(this._$AH) || (this._$AH = [], this._$AR());
    const t = this._$AH;
    let i, s = 0;
    for (const r of e) s === t.length ? t.push(i = new ae(this.O(be()), this.O(be()), this, this.options)) : i = t[s], i._$AI(r), s++;
    s < t.length && (this._$AR(i && i._$AB.nextSibling, s), t.length = s);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(!1, !0, t); e !== this._$AB; ) {
      const i = zi(e).nextSibling;
      zi(e).remove(), e = i;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class vt {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, i, s, r) {
    this.type = 1, this._$AH = l, this._$AN = void 0, this.element = e, this.name = t, this._$AM = s, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = l;
  }
  _$AI(e, t = this, i, s) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) e = se(this, e, t, 0), o = !ve(e) || e !== this._$AH && e !== z, o && (this._$AH = e);
    else {
      const d = e;
      let c, h;
      for (e = r[0], c = 0; c < r.length - 1; c++) h = se(this, d[i + c], t, c), h === z && (h = this._$AH[c]), o ||= !ve(h) || h !== this._$AH[c], h === l ? e = l : e !== l && (e += (h ?? "") + r[c + 1]), this._$AH[c] = h;
    }
    o && !s && this.j(e);
  }
  j(e) {
    e === l ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class Ys extends vt {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === l ? void 0 : e;
  }
}
class Gs extends vt {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== l);
  }
}
class Zs extends vt {
  constructor(e, t, i, s, r) {
    super(e, t, i, s, r), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = se(this, e, t, 0) ?? l) === z) return;
    const i = this._$AH, s = e === l && i !== l || e.capture !== i.capture || e.once !== i.once || e.passive !== i.passive, r = e !== l && (i === l || s);
    s && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class ea {
  constructor(e, t, i) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    se(this, e);
  }
}
const ta = { I: ae }, ia = vi.litHtmlPolyfillSupport;
ia?.(ye, ae), (vi.litHtmlVersions ??= []).push("3.3.3");
const sa = (n, e, t) => {
  const i = t?.renderBefore ?? e;
  let s = i._$litPart$;
  if (s === void 0) {
    const r = t?.renderBefore ?? null;
    i._$litPart$ = s = new ae(e.insertBefore(be(), r), r, void 0, t ?? {});
  }
  return s._$AI(n), s;
};
const wi = globalThis;
let x = class extends Z {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = sa(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return z;
  }
};
x._$litElement$ = !0, x.finalized = !0, wi.litElementHydrateSupport?.({ LitElement: x });
const aa = wi.litElementPolyfillSupport;
aa?.({ LitElement: x });
(wi.litElementVersions ??= []).push("4.2.2");
const E = C`
  :host {
    display: block;
    min-height: 0;
    min-width: 0;
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
    padding: 16px clamp(10px, 3vw, 40px) max(16px, env(safe-area-inset-bottom));
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  header .companion-icon {
    width: 60px;
    height: 60px;
    object-fit: contain;
    flex: 0 0 60px;
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
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    min-width: 0;
    overflow: hidden;
  }
  .card-head {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .card-head h2 {
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
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
  .manual-picker {
    position: relative;
    margin-bottom: 16px;
  }
  .movie-suggestions {
    position: absolute;
    top: 100%;
    inset-inline: 0;
    z-index: 20;
    display: grid;
    max-height: min(
      260px,
      calc(var(--companion-viewport-height, 100dvh) * 0.35)
    );
    overflow: auto;
    overscroll-behavior: contain;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: 0 4px 12px #0004;
  }
  .movie-suggestions button {
    text-align: left;
    border-radius: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .movie-suggestions [aria-selected="true"] {
    background: var(--line);
  }
  .manual-metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
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
    min-width: 0;
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
    margin: 12px 0;
    padding: 4px 0 0;
  }
  .page-navigation {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .page-navigation > .page-tabs {
    flex: 1;
    min-width: 0;
  }
  .view-mode-slot,
  .mode-control {
    flex: none;
  }
  .view-mode-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 6px 9px;
    gap: 6px;
    min-height: 34px;
    background: var(--divider-color, #666);
    color: var(--primary-text-color);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
  }
  .mode-track {
    position: relative;
    display: inline-block;
    width: 30px;
    height: 16px;
    border-radius: 999px;
    background: #0003;
    flex: none;
  }
  .mode-thumb {
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }
  .view-mode-pill[aria-checked="true"] {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }
  .view-mode-pill[aria-checked="true"] .mode-thumb {
    transform: translateX(14px);
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
  .settings-page {
    padding: 20px;
    max-width: 900px;
    overflow: visible;
    margin-top: 24px;
  }
  dialog {
    --dialog-background: var(--surface);
    --dialog-gutter: clamp(12px, 2vw, 20px);
    width: min(560px, calc(100% - 24px));
    max-width: calc(100% - 16px);
    max-height: calc(
      var(--companion-viewport-height, 100dvh) -
        24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
    );
    overflow: auto;
    overscroll-behavior: contain;
    scroll-padding-block: 68px;
    padding: var(--dialog-gutter);
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--dialog-background);
    color: inherit;
  }
  dialog:modal {
    inset-block-start: var(--companion-viewport-top, 0px);
    inset-block-end: var(--companion-viewport-bottom, 0px);
  }
  dialog.inset-dialog {
    --dialog-top-gap: max(
      calc(var(--companion-viewport-height, 100dvh) * 0.15),
      calc(env(safe-area-inset-top) + 8px)
    );
    max-height: calc(
      var(--companion-viewport-height, 100dvh) - var(--dialog-top-gap) - env(
          safe-area-inset-bottom
        ) -
        12px
    );
  }
  dialog.inset-dialog:modal {
    inset-block-start: calc(
      var(--companion-viewport-top, 0px) + var(--dialog-top-gap)
    );
    inset-block-end: auto;
    margin-block: 0;
  }
  dialog > .card-head,
  dialog > .movie-heading {
    position: sticky;
    top: calc(0px - var(--dialog-gutter));
    z-index: 25;
    margin: calc(0px - var(--dialog-gutter)) calc(0px - var(--dialog-gutter))
      14px;
    padding: 10px var(--dialog-gutter);
    background: var(--dialog-background);
    border-bottom: 1px solid var(--line);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 60%);
  }
  dialog .card-head {
    align-items: flex-start;
  }
  dialog .card-head h2 {
    margin: 0;
  }
  .dialog-close {
    display: grid;
    place-items: center;
    flex: 0 0 36px;
    width: 36px;
    min-height: 36px;
    padding: 6px;
    background: transparent;
    border: 0;
    color: var(--muted);
  }
  .dialog-close svg {
    width: 24px;
    height: 24px;
  }
  .dialog-footer {
    margin: 14px calc(0px - var(--dialog-gutter))
      calc(0px - var(--dialog-gutter));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 8px var(--dialog-gutter) max(8px, env(safe-area-inset-bottom));
    position: sticky;
    bottom: calc(0px - var(--dialog-gutter));
    background: var(--dialog-background, var(--surface));
    z-index: 12;
  }
  .dialog-footer button {
    white-space: normal;
    max-width: 100%;
  }
  .dialog-footer .primary,
  .dialog-footer .danger {
    order: 1;
  }
  .field-actions {
    align-items: end;
  }
  .settings-actions {
    position: sticky;
    top: var(--companion-sticky-top, 0px);
    z-index: 15;
    background: var(--surface);
    padding: 8px 0;
    margin-bottom: 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line);
  }
  .settings-actions h2 {
    margin: 0;
    flex: 1;
  }
  .settings-actions .actions {
    flex-wrap: nowrap;
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
  @media (max-width: 600px) {
    header .companion-icon {
      display: none;
    }
    button,
    input,
    select {
      min-height: 44px;
    }
    input,
    select,
    textarea {
      font-size: 16px;
    }
    input[type="checkbox"],
    input[type="radio"] {
      min-height: 20px;
    }
    .check {
      min-height: 44px;
      margin: 4px 0;
    }
    .dialog-close {
      flex-basis: 44px;
      width: 44px;
      min-height: 44px;
    }
    dialog {
      width: min(560px, calc(100% - 16px));
      max-height: calc(
        var(--companion-viewport-height, 100dvh) -
          16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
      );
    }
    dialog h2 {
      font-size: 17px;
      line-height: 1.3;
      align-self: center;
    }
    .dialog-footer {
      gap: 8px;
    }
    .dialog-footer button {
      padding-inline: 10px;
      min-width: 0;
      font-size: 13px;
    }
    .notice,
    .warning,
    .error {
      padding: 10px 12px;
      margin-block: 12px;
      line-height: 1.45;
    }
    .page-tabs {
      margin: 8px 0;
      gap: 0;
    }
    .page-tabs button {
      padding: 8px 10px;
    }
    .view-mode-pill {
      min-height: 36px;
    }
    header .eyebrow,
    header p {
      display: none;
    }
    h1 {
      font-size: 21px;
      letter-spacing: -0.025em;
    }
    header {
      gap: 8px;
      padding-bottom: 8px;
    }
    .settings-page {
      padding: 12px;
      margin-top: 12px;
    }
    .settings-actions h2 {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .settings-actions .actions {
      flex: 1;
      justify-content: flex-end;
    }
    .settings-actions {
      gap: 6px;
    }
    .playback-layout {
      grid-template-columns: 80px minmax(0, 1fr);
      gap: 12px;
      padding-left: 16px;
      padding-right: 16px;
    }
    main {
      padding-top: 8px;
    }
    header {
      flex-wrap: wrap;
    }
    header .primary {
      width: 100%;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .card-head:not(dialog > .card-head),
    .editor {
      padding: 12px;
    }
  }
  @media (max-height: 540px) {
    dialog {
      --dialog-gutter: 12px;
    }
    dialog > .card-head,
    dialog > .movie-heading {
      padding-block: 6px;
    }
    .dialog-footer {
      margin-top: 10px;
      padding-block: 6px;
    }
  }
`;
function R(n) {
  const e = {
    add: $`<path d="M12 4v16M4 12h16"/>`,
    search: $`<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>`,
    filter: $`<path d="M3 5h18l-7 8v6l-4 2v-8z"/>`,
    clear: $`<path d="m6 6 12 12M18 6 6 18"/>`,
    shuffle: $`<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>`,
    ascending: $`<path d="M7 20V4m-4 4 4-4 4 4m3-1h7m-7 5h5m-5 5h3"/>`,
    descending: $`<path d="M7 4v16m-4-4 4 4 4-4m3-9h3m-3 5h5m-5 5h7"/>`,
    options: $`<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="18" r="2" fill="var(--surface)"/>`,
    first: $`<path d="M5 5v14m13-14-7 7 7 7"/>`,
    previous: $`<path d="m15 5-7 7 7 7"/>`,
    next: $`<path d="m9 5 7 7-7 7"/>`,
    collection: $`<path fill="#ffca28" stroke="#ffca28" d="M6 2h12v20l-6-4-6 4z"/><path fill="#302b16" stroke="none" d="m12 5 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z"/>`,
    refresh: $`<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>`,
    edit: $`<path d="m15 4 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16zM4 20h8"/>`,
    scrape: $`<path d="M3 9h15v4M3 9l-1-4 14-3 1 4zM6 4l3 4m3-5 3 4M3 9v11h8"/><circle cx="16" cy="16" r="4"/><path d="m19 19 3 3M6 13h3m-3 3h2"/>`,
    artwork: $`<rect x="8" y="2" width="13" height="9" rx="1"/><path d="m10 9 3-3 2 2 2-3 2 2"/><rect x="3" y="14" width="13" height="9" rx="1"/><path d="m5 21 3-3 2 2 2-3 2 2M3 10V6h3m0 0L4 4m2 2L4 8m17 6v4h-3m0 0 2-2m-2 2 2 2"/>`,
    power: $`<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>`,
    play: $`<path fill="currentColor" stroke="none" d="M7 3v18l15-9z"/>`
  };
  return $`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e[n]}</svg>`;
}
const xi = C`
  .icon-action-wrap {
    position: relative;
    display: inline-flex;
  }
  .icon-action {
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }
  .icon-action svg {
    width: 24px;
    height: 24px;
    flex: none;
  }
  .icon-action-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .action-tooltip {
    position: absolute;
    inset-block-end: calc(100% + 8px);
    inset-inline-end: 0;
    z-index: 30;
    width: max-content;
    max-width: min(220px, 70vw);
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface, #202020);
    color: var(--primary-text-color, #fff);
    font: 12px/1.4 system-ui;
    box-shadow: 0 3px 12px #0006;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .action-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 15px;
    border: 5px solid transparent;
    border-top-color: var(--surface, #202020);
  }
  .icon-action-wrap:not([data-tooltip-dismissed]):hover .action-tooltip,
  .icon-action-wrap:not([data-tooltip-dismissed]):has(
      .icon-action:focus-visible
    )
    .action-tooltip {
    opacity: 1;
    visibility: visible;
  }
`;
function ze(n, e, t, i, s = "") {
  return a`<span
    class="icon-action-wrap"
    @pointerenter=${(r) => r.currentTarget.removeAttribute("data-tooltip-dismissed")}
    @focusin=${(r) => {
    r.target.matches(":focus-visible") && r.currentTarget.removeAttribute(
      "data-tooltip-dismissed"
    );
  }}
    ><button
      type="button"
      class=${`icon-action ${s}`}
      aria-label=${n}
      aria-describedby="action-tooltip"
      ?disabled=${t}
      @click=${(r) => {
    r.currentTarget.parentElement.setAttribute(
      "data-tooltip-dismissed",
      ""
    ), i();
  }}
    >
      ${R(e)}<span class="icon-action-label">${n}</span></button
    ><span class="action-tooltip" id="action-tooltip" role="tooltip"
      >${n}</span
    ></span
  >`;
}
function S(n, e = !1) {
  return a`<button
    type="button"
    class="dialog-close"
    aria-label="Close"
    title="Close"
    ?disabled=${e}
    @click=${n}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </button>`;
}
function q(n) {
  const e = n.currentTarget;
  if (n.target !== e) return;
  const t = e.getBoundingClientRect();
  n.clientX >= t.left && n.clientX <= t.right && n.clientY >= t.top && n.clientY <= t.bottom || e.dispatchEvent(new Event("cancel", { cancelable: !0 })) && e.close();
}
const Oe = class Oe extends x {
  constructor() {
    super(...arguments), this.value = "", this.disabled = !1, this.allowAdd = !1, this.filtered = !1, this.filterLabel = "", this.scopeKey = "", this.draft = "", this.generation = 0;
  }
  willUpdate(e) {
    (e.has("context") || e.has("scopeKey")) && this.close();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.close();
  }
  signal(e, t) {
    this.disabled || this.dispatchEvent(
      new CustomEvent(e, { detail: t, bubbles: !0, composed: !0 })
    );
  }
  close(e) {
    e?.preventDefault(), this.generation++, this.draft = "", this.renderRoot.querySelector("dialog")?.close();
  }
  async search() {
    if (this.disabled) return;
    const e = ++this.generation;
    this.draft = this.value, this.requestUpdate(), await this.updateComplete, !(!this.isConnected || e !== this.generation) && (this.renderRoot.querySelector("dialog")?.showModal(), this.renderRoot.querySelector("input")?.focus());
  }
  render() {
    return a`<div
        class="shortcuts"
        role="toolbar"
        aria-label="Journal calendar shortcuts"
      >
        <button
          type="button"
          aria-label="Search Journal"
          title="Search Journal"
          aria-haspopup="dialog"
          ?disabled=${this.disabled}
          class=${this.value ? "active" : ""}
          @click=${this.search}
        >
          ${R("search")}
        </button>
        ${this.allowAdd ? a`<button type="button" aria-label="Add viewing" title="Add viewing" ?disabled=${this.disabled} @click=${() => this.signal("journal-add")}>${R("add")}</button>` : ""}
        ${this.filterLabel ? a`<button type="button" aria-label="Show all viewings" title="Show all viewings" ?disabled=${this.disabled} @click=${() => this.signal("journal-clear-movie")}>All</button>` : ""}
        <button
          type="button"
          aria-label="Journal options"
          title="Options"
          aria-haspopup="dialog"
          ?disabled=${this.disabled}
          class=${this.filtered ? "active" : ""}
          @click=${() => this.signal("journal-open-options")}
        >
          ${R("options")}
        </button>
      </div>
      <dialog
        aria-labelledby="journal-search-title"
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="journal-search-title">Search Journal</h2>
          ${S((e) => this.close(e))}
        </div>
        ${this.filterLabel ? a`<p class="muted">${this.filterLabel}</p>` : ""}
        <form
          @submit=${(e) => {
      e.preventDefault(), !this.disabled && (this.signal("journal-search", this.draft), this.close());
    }}
        >
          <label
            >Title<input
              name="journal_mobile_search"
              type="search"
              maxlength="500"
              .value=${this.draft}
              @input=${(e) => {
      this.draft = e.target.value;
    }}
          /></label>
          <div class="dialog-footer">
            <button class="primary" type="submit" ?disabled=${this.disabled}>
              Search
            </button>
          </div>
        </form>
      </dialog>`;
  }
};
Oe.properties = {
  value: {},
  disabled: { type: Boolean },
  allowAdd: { type: Boolean },
  filtered: { type: Boolean },
  filterLabel: {},
  context: { attribute: !1 },
  scopeKey: {}
}, Oe.styles = [
  E,
  C`
      :host {
        display: none;
      }
      .shortcuts {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 6px 8px;
      }
      .shortcuts button {
        width: 44px;
        height: 44px;
        min-height: 44px;
        padding: 10px;
        display: grid;
        place-items: center;
        border-radius: 7px;
      }
      .shortcuts svg {
        width: 22px;
        height: 22px;
      }
      .active {
        color: var(--primary-color, #03a9f4);
        border-color: currentColor;
      }
      dialog {
        width: min(380px, calc(100% - 24px));
      }
      @media (max-width: 700px) {
        :host {
          display: block;
        }
      }
    `
];
let Pt = Oe;
customElements.get("kaleidescape-journal-shortcuts") || customElements.define("kaleidescape-journal-shortcuts", Pt);
function te() {
  const n = window.innerWidth;
  return n <= 600 ? "mobile" : n <= 1024 ? "tablet" : "desktop";
}
class v extends Error {
  constructor(e) {
    super(e), this.code = e;
  }
}
const f = "kaleidescape_companion", ra = 15e3, b = ({ entry_id: n, dataset_id: e }) => ({
  entry_id: n,
  dataset_id: e
}), na = 256 * 1024 * 1024, Fi = 5 * 1024 * 1024, oa = 32 * 1024 * 1024;
function ie() {
  const n = globalThis.crypto;
  if (typeof n?.randomUUID == "function") return n.randomUUID();
  if (typeof n?.getRandomValues != "function")
    throw new v("request_id_unavailable");
  const e = n.getRandomValues(new Uint8Array(16));
  e[6] = e[6] & 15 | 64, e[8] = e[8] & 63 | 128;
  const t = Array.from(
    e,
    (i) => i.toString(16).padStart(2, "0")
  ).join("");
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
}
async function qe(n, e, t) {
  const i = n.body?.getReader();
  if (!i) throw new v("storage_error");
  const s = [];
  let r = 0;
  try {
    for (; ; ) {
      const { value: o, done: d } = await i.read();
      if (d) break;
      if (r += o.byteLength, r > e) throw new v("export_too_large");
      s.push(new Uint8Array(o));
    }
    return new Blob(s, { type: t });
  } finally {
    await i.cancel().catch(() => {
    }), i.releaseLock();
  }
}
function g(n) {
  return typeof n == "object" && n !== null && "code" in n && typeof n.code == "string" ? n.code : "connection_lost";
}
function y(n) {
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
    library_timeout: "The library server took too long to respond. Check its status and the Home Assistant logs.",
    library_destination: "The library must use a private LAN hostname or address.",
    library_format: "The library page format was not recognized. Cached data is retained.",
    library_response: "The library returned an unsupported response. Cached data is retained.",
    library_changed: "The library changed during sync. Previous collection data was retained; try again later.",
    query_limit: "This search exceeded its execution budget. Refine the text or simplify the conditions and try again.",
    repair_limit: "Metadata repair exceeded its 10,000-entry or execution limit. No changes were saved.",
    query_syntax: "Check the field names, operators and quoted values in the condition.",
    database_page_too_large: "The database page is too large. Choose fewer rows per page.",
    library_page_too_large: "This library page is too large. Reduce entries per page and try again.",
    collection_disabled: "Enable collection changes and collection sync in Settings first.",
    collection_form: "The server’s collection form was not recognized. Refresh or sync before trying again.",
    collection_uncertain: "Check or acknowledge the previous unconfirmed collection change first.",
    collection_limit: "Collection request history reached its storage limit.",
    library_too_large: "A library response exceeded its safety limit. Cached data is retained.",
    library_artwork: "Some artwork could not be cached. Previous artwork is retained when available.",
    provider_destination: "The provider request destination or path failed the network allowlist checks. No request was sent to that destination.",
    provider_content_type: "The provider returned an unsupported content type or the image bytes did not match that type.",
    provider_encoding: "The provider returned compressed content despite requesting an uncompressed response.",
    provider_response_too_large: "The provider response exceeded the download size limit.",
    provider_http_error: "The provider returned an unsuccessful HTTP response. Check the preceding HTTP status event.",
    provider_access_denied: "The provider denied access. Check the scraper credentials and permissions.",
    provider_rate_limited: "The provider rate limit was reached. Wait before trying again.",
    provider_artwork_unavailable: "The selected image is no longer available from this provider.",
    provider_disabled: "The required provider or artwork feature is disabled.",
    metadata_disabled: "Enable and configure a scraper in Settings first.",
    metadata_unavailable: "Metadata retrieval failed. Try again.",
    provider_identity_mismatch: "The provider could not verify this movie's title and release year.",
    tmdb_not_found: "TMDB did not find a matching title and release year.",
    tmdb_ambiguous: "TMDB returned more than one matching movie. No data was imported.",
    store_search_truncated: "The Kaleidescape Store returned too many results to verify a unique match. Refine the search and choose a match for review.",
    store_missing_library_credits: "The Library needs four scanned actors and a director before this Store match can be verified.",
    store_credit_mismatch: "The Store results did not match the scanned cast and director. Choose a match for review."
  }[g(n)] ?? "The connection was interrupted. The result could not be confirmed.";
}
async function M(n, e = ra) {
  let t;
  try {
    return await Promise.race([
      n,
      new Promise((i, s) => {
        t = setTimeout(
          () => s(new v("connection_lost")),
          e
        );
      })
    ]);
  } finally {
    clearTimeout(t);
  }
}
class ki {
  constructor(e) {
    this.transport = e;
  }
  call(e) {
    return M(this.transport.callWS(e));
  }
  automationStatuses(e) {
    return this.call({
      type: `${f}/automations/status`,
      ...b(e)
    });
  }
  updateAutomationBlueprint(e, t, i) {
    return this.call({
      type: `${f}/automations/update`,
      ...b(e),
      template: t,
      revision: i
    });
  }
  automationTemplate(e, t) {
    return this.call({
      type: `${f}/automations/template`,
      ...b(e),
      template: t
    });
  }
  installAutomationBlueprint(e, t, i = !1) {
    return this.call({
      type: "blueprint/save",
      domain: "automation",
      path: e,
      yaml: t,
      ...i ? { allow_override: !0 } : {}
    });
  }
  controlInfo(e) {
    return this.call({ type: `${f}/control/info`, ...b(e) });
  }
  controlDiscover(e) {
    return M(
      this.transport.callWS({
        type: `${f}/control/discover`,
        ...b(e)
      }),
      7e4
    );
  }
  controlStatus(e, t) {
    return this.call({
      type: `${f}/control/status`,
      ...b(e),
      ...t ? { player_id: t } : {}
    });
  }
  controlPrepare(e, t, i, s) {
    return this.call({
      type: `${f}/control/prepare`,
      ...b(e),
      operation: t,
      ...i ? { title_id: i } : {},
      ...s ? { player_id: s } : {}
    });
  }
  prepareControl(e, t) {
    return this.prepareCommand(e, "control/execute", {
      token: t
    });
  }
  controlExecute(e) {
    return this.call({ ...e.message });
  }
  controlAcknowledge(e, t) {
    return this.call({
      type: `${f}/control/acknowledge`,
      ...b(e),
      request_id: t,
      confirmation: "REVIEWED"
    });
  }
  metadataStatus(e, t = !1) {
    return this.call({
      type: `${f}/metadata/${t ? "sync" : "status"}`,
      ...b(e)
    });
  }
  titleScrapeOptions(e, t) {
    return this.call({
      type: `${f}/metadata/title/options`,
      ...b(e),
      title_id: t
    });
  }
  titleScrapePreview(e, t, i, s = "", r = "") {
    return M(
      this.transport.callWS({
        type: `${f}/metadata/title/preview`,
        ...b(e),
        title_id: t,
        provider: i,
        search_id: s,
        choice: r
      }),
      185e3
    );
  }
  titleScrapeSearch(e, t, i, s, r) {
    return M(
      this.transport.callWS({
        type: `${f}/metadata/title/search`,
        ...b(e),
        title_id: t,
        provider: i,
        query: s,
        ...r !== void 0 ? { year: r } : {}
      }),
      185e3
    );
  }
  titleScrapeRefresh(e, t, i, s, r, o = !1) {
    return M(
      this.transport.callWS({
        type: `${f}/metadata/title/refresh`,
        ...b(e),
        request_id: ie(),
        title_id: t,
        provider: i,
        query: s,
        ...r !== void 0 ? { year: r } : {},
        stage: o
      }),
      185e3
    );
  }
  titleScrapeRefreshChoice(e, t, i, s, r, o = !1) {
    return M(
      this.transport.callWS({
        type: `${f}/metadata/title/refresh_choice`,
        ...b(e),
        request_id: ie(),
        title_id: t,
        provider: i,
        search_id: s,
        choice: r,
        stage: o
      }),
      185e3
    );
  }
  prepareMetadataAction(e, t) {
    return this.prepareCommand(e, "metadata/title/action", { data: t });
  }
  prepareMetadataDraft(e, t) {
    return this.prepareCommand(e, "metadata/title/draft", { data: t });
  }
  applyMetadataDraft(e) {
    return M(
      this.transport.callWS({ ...e.message }),
      185e3
    );
  }
  prepareTitleScrape(e, t) {
    return this.prepareCommand(e, "metadata/title/apply", { data: t });
  }
  prepareScraperAvailability(e, t) {
    return this.prepareCommand(e, "metadata/title/availability", { data: t });
  }
  prepareArtworkAvailability(e, t) {
    return this.prepareCommand(e, "metadata/title/availability", { data: t });
  }
  prepareScrapeExpectations(e, t) {
    return this.prepareCommand(e, "metadata/title/availability", { data: t });
  }
  cancelTitleScrape(e, t) {
    return this.call({
      type: `${f}/metadata/title/cancel`,
      ...b(e),
      plan_id: t
    });
  }
  applyTitleScrape(e) {
    return M(
      this.transport.callWS({ ...e.message }),
      8e4
    );
  }
  async titleScrapeImage(e, t, i, s) {
    if (!/^[a-f0-9-]{36}$/.test(t) || !/^(poster|backdrop|match)-[0-9]{1,3}$/.test(i))
      throw new v("invalid_request");
    return this.raster(
      `/api/${f}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/metadata/review/${t}/image/${i}`,
      s
    );
  }
  metadataPreview(e) {
    return this.call({
      type: `${f}/journal/metadata/preview`,
      ...b(e)
    });
  }
  prepareMetadataRepair(e, t) {
    return this.prepareCommand(e, "journal/metadata/repair", {
      token: t,
      confirmation: "REPAIR METADATA"
    });
  }
  repairMetadata(e) {
    return this.call({ ...e.message });
  }
  prepareLibraryReset(e, t, i) {
    return this.prepareCommand(e, "library/edit/reset", {
      title_id: t,
      snapshot: i,
      confirmation: "RESTORE SOURCE"
    });
  }
  libraryEdit(e, t) {
    return this.call({
      type: `${f}/library/edit/get`,
      ...b(e),
      title_id: t
    });
  }
  groupPurchaseEdit(e, t) {
    return this.call({
      ...b(e),
      type: `${f}/library/purchases/edit/get`,
      title_id: t
    });
  }
  prepareGroupPurchaseEdit(e, t, i, s) {
    return this.prepareCommand(e, "library/purchases/edit/save", {
      title_id: t,
      snapshot: i,
      data: s
    });
  }
  saveGroupPurchaseEdit(e) {
    return this.call({ ...e.message });
  }
  prepareLibraryEdit(e, t, i, s) {
    return this.prepareCommand(e, "library/edit/save", {
      title_id: t,
      snapshot: i,
      patch: s
    });
  }
  saveLibraryEdit(e) {
    return this.call({ ...e.message });
  }
  uiPreferences(e, t = !1, i = "library", s = te()) {
    return this.call({
      type: `${f}/ui/${t ? "shared" : "preferences"}/get`,
      ...i !== "library" ? { area: i } : {},
      ...t ? {} : { profile: s },
      ...b(e)
    });
  }
  prepareUIPreferences(e, t, i, s, r = "library", o = te()) {
    return this.prepareCommand(
      e,
      `ui/${t ? "shared" : "preferences"}/update`,
      {
        revision: i,
        patch: s,
        ...r !== "library" ? { area: r } : {},
        ...t ? {} : { profile: o }
      }
    );
  }
  saveUIPreferences(e) {
    return this.call({ ...e.message });
  }
  testDashboard(e, t, i) {
    return this.call({
      type: `${f}/dashboard/preview`,
      ...b(e),
      request_id: t,
      name: i
    });
  }
  verifyTestDashboard(e, t) {
    return this.call({
      type: `${f}/dashboard/verify`,
      ...b(e),
      request_id: t
    });
  }
  haDashboards() {
    return this.call({ type: "lovelace/dashboards/list" });
  }
  createHATestDashboard(e) {
    return this.call({
      type: "lovelace/dashboards/create",
      title: e.title,
      url_path: e.url_path,
      mode: "storage",
      icon: "mdi:test-tube",
      show_in_sidebar: !0,
      require_admin: !1
    });
  }
  haTestDashboardConfig(e) {
    return this.call({ type: "lovelace/config", url_path: e, force: !0 });
  }
  saveHATestDashboard(e) {
    return this.call({
      type: "lovelace/config/save",
      url_path: e.url_path,
      config: e.config
    });
  }
  info() {
    return this.call({ type: `${f}/info` });
  }
  list(e, t = "", i = "", s, r = "completed_at", o = !0, d = !1, c) {
    return this.call({
      type: `${f}/${c ? "library/viewings" : "journal/list"}`,
      ...c ? { title_id: c } : {},
      ...b(e),
      query: t,
      limit: 25,
      sort: r,
      descending: o,
      fuzzy: d,
      ...i ? { status: i } : {},
      ...s ? { cursor: s } : {}
    });
  }
  get(e, t) {
    return this.call({
      type: `${f}/journal/get`,
      ...b(e),
      viewing_id: t
    });
  }
  calendarMonth(e, t, i, s = "", r = "", o = !1, d) {
    return this.call({
      type: `${f}/journal/calendar`,
      ...b(e),
      start: t,
      end: i,
      query: s,
      fuzzy: o,
      ...r ? { status: r } : {},
      ...d ? { title_id: d } : {}
    });
  }
  calendarDetails(e, t) {
    return this.call({
      type: `${f}/journal/calendar/get`,
      ...b(e),
      viewing_id: t
    });
  }
  viewingLibrary(e, t) {
    return this.call({
      type: `${f}/library/viewing`,
      ...b(e),
      viewing_id: t
    });
  }
  sessions(e, t) {
    return this.call({
      type: `${f}/journal/sessions`,
      ...b(e),
      viewing_id: t
    });
  }
  nowPlaying(e, t) {
    return this.call({
      type: `${f}/now_playing`,
      ...b(e),
      ...t ? { player_id: t } : {}
    });
  }
  libraryInfo(e) {
    return this.call({ type: `${f}/library/info`, ...b(e) });
  }
  libraryPurchaseTotals(e) {
    return this.call({
      type: `${f}/library/purchases/summary`,
      ...b(e)
    });
  }
  libraryList(e, t = {}) {
    return this.call({
      type: `${f}/library/list`,
      ...b(e),
      filters: t
    });
  }
  libraryVersions(e, t, i = 0, s) {
    return this.call({
      type: `${f}/library/versions`,
      ...b(e),
      title_id: t,
      offset: i,
      ...s === void 0 ? {} : { revision: s }
    });
  }
  librarySync(e) {
    return this.call({ type: `${f}/library/sync`, ...b(e) });
  }
  collectionTargets(e, t, i) {
    return this.call({
      type: `${f}/library/collections/targets`,
      ...b(e),
      title_id: t,
      revision: i
    });
  }
  refreshTitleCollections(e, t, i) {
    return M(
      this.transport.callWS({
        type: `${f}/library/collections/refresh`,
        ...b(e),
        title_id: t,
        revision: i
      }),
      31e4
    );
  }
  dismissCollectionJob(e, t) {
    return this.call({
      type: `${f}/library/collections/dismiss`,
      ...b(e),
      request_id: t
    });
  }
  prepareCollectionAdd(e, t, i, s) {
    return this.prepareCommand(e, "library/collections/add", {
      title_id: t,
      collection: i,
      revision: s
    });
  }
  prepareCollectionChange(e, t, i, s, r) {
    return this.prepareCommand(e, "library/collections/queue", {
      title_id: t,
      collection: i,
      operation: s,
      revision: r
    });
  }
  queueCollectionChange(e) {
    return this.call({ ...e.message });
  }
  collectionAdd(e) {
    return this.call({ ...e.message });
  }
  collectionCheck(e, t) {
    return this.call({
      type: `${f}/library/collections/check`,
      ...b(e),
      request_id: t
    });
  }
  collectionAcknowledge(e, t) {
    return this.call({
      type: `${f}/library/collections/acknowledge`,
      ...b(e),
      request_id: t,
      confirmation: "ACKNOWLEDGE"
    });
  }
  async libraryArtwork(e, t, i) {
    if (!/^[a-f0-9]{64}$/.test(t)) throw new v("invalid_request");
    return this.raster(
      `/api/${f}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/library/artwork/${t}`,
      i
    );
  }
  async raster(e, t) {
    const i = await this.transport.fetchWithAuth(e, {
      signal: t,
      cache: "no-store",
      redirect: "error"
    });
    if (!i.ok)
      throw await i.body?.cancel(), new v(
        [401, 403].includes(i.status) ? "unauthorized" : "not_found"
      );
    const s = i.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (!s || !["image/jpeg", "image/png", "image/webp"].includes(s))
      throw await i.body?.cancel(), new v("invalid_request");
    return qe(i, Fi, s);
  }
  settingsTransfer(e, t, i, s = {}, r = "") {
    return this.call({
      ...b(e),
      type: `${f}/settings/transfer`,
      operation: t,
      categories: i,
      data: s,
      request_id: r
    });
  }
  settings(e, t, i = {}) {
    return this.call({
      ...i,
      ...b(e),
      type: `${f}/settings/${t}`
    });
  }
  inspect(e, t, i = 0, s, r) {
    return this.call({
      type: `${f}/database/inspect`,
      ...b(e),
      table: t,
      offset: i,
      ...s == null ? {} : { revision: s },
      ...r
    });
  }
  preparePurge(e, t) {
    return this.prepareCommand(e, "database/purge", t);
  }
  prepareDatabaseUpdate(e, t) {
    return this.prepareCommand(e, "database/update", t);
  }
  searchImportMatches(e, t, i, s) {
    return this.call({
      type: `${f}/database/import/search`,
      ...b(e),
      plan_id: t.plan_id,
      revision: t.revision,
      purchase_key: i,
      query: s
    });
  }
  matchImportPurchase(e, t, i, s) {
    return this.call({
      type: `${f}/database/import/match`,
      ...b(e),
      plan_id: t.plan_id,
      revision: t.revision,
      purchase_key: i,
      title_id: s
    });
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
  async previewImport(e, t, i, s = !1) {
    const r = /\.(sqlite|sqlite3|db)$/i.test(t.name) ? "sqlite" : /\.json$/i.test(t.name) ? "json" : null;
    if (!r) throw new v("invalid_request");
    if (!t.size || t.size > oa)
      throw new v("import_too_large");
    const o = await this.transport.fetchWithAuth(
      `/api/${f}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/import/preview?format=${r}${s ? "&purchase_only=true" : ""}`,
      {
        method: "POST",
        body: t,
        signal: i,
        redirect: "error",
        cache: "no-store",
        headers: { "Content-Type": "application/octet-stream" }
      }
    );
    if (!o.ok) {
      const c = {
        401: "unauthorized",
        403: "unauthorized",
        413: "import_too_large",
        404: "not_found"
      };
      if (c[o.status]) throw new v(c[o.status]);
      const h = await o.json().catch(() => null);
      throw new v(h?.code ?? "connection_lost");
    }
    const d = await qe(
      o,
      8 * 1024 * 1024,
      "application/json"
    );
    return JSON.parse(await d.text());
  }
  reconcilePurchases(e) {
    return this.call({
      type: `${f}/purchases/reconcile`,
      ...b(e)
    });
  }
  previewPurchaseRepair(e, t, i, s, r) {
    return this.call({
      ...b(e),
      type: `${f}/purchases/repair/preview`,
      action: t,
      key: i,
      token: s,
      changes: r
    });
  }
  preparePurchaseRepair(e, t) {
    return this.prepareCommand(e, "purchases/repair/apply", {
      plan_id: t.plan_id,
      revision: t.revision
    });
  }
  applyPurchaseRepair(e) {
    return this.call({ ...e.message });
  }
  purge(e) {
    return this.call({ ...e.message });
  }
  async artwork(e, t) {
    if (!/^media_player\.[a-z0-9_]{1,255}$/.test(e))
      throw new v("invalid_request");
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
      throw new v(
        [401, 403].includes(i.status) ? "unauthorized" : "not_ready"
      );
    }
    const s = i.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    return !s || !["image/jpeg", "image/png", "image/webp"].includes(s) ? (await i.body?.cancel(), null) : qe(i, Fi, s);
  }
  librarySuggestions(e, t, i, s = !1) {
    return this.call({
      type: `${f}/library/suggest`,
      ...b(e),
      field: t,
      query: i,
      fuzzy: s
    });
  }
  librarySearch(e, t, i = !0) {
    return this.call({
      type: `${f}/library/search`,
      ...b(e),
      query: t,
      fuzzy: i
    });
  }
  calendarStatus(e) {
    return this.call({
      type: `${f}/calendar/status`,
      ...b(e)
    });
  }
  prepareCalendarSync(e, t) {
    return this.prepareCommand(e, "calendar/sync", {
      fingerprint: t,
      confirmation: "EXPORT JOURNAL"
    });
  }
  calendarSync(e) {
    return this.call({ ...e.message });
  }
  calendarMaintain(e, t, i, s = "") {
    return this.call({
      type: `${f}/calendar/maintain`,
      ...b(e),
      action: t,
      fingerprint: i,
      review_token: s,
      confirmation: t === "acknowledge" ? "ACKNOWLEDGE" : ""
    });
  }
  calendarCancel(e, t) {
    return this.call({
      type: `${f}/calendar/cancel`,
      ...b(e),
      job_id: t
    });
  }
  validateDatabaseQuery(e, t, i) {
    return this.call({
      type: `${f}/database/validate_query`,
      ...b(e),
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
    const r = [];
    let o = 0;
    for (; i(); ) {
      const d = await this.libraryList(e, {
        ...t,
        grouped: !0,
        limit: 1e3,
        offset: r.length,
        ...s ? {
          revision: s.revision,
          preferences_key: s.preferences_key,
          ...s.random_seed !== void 0 ? { random_seed: s.random_seed } : {}
        } : {}
      });
      if (!i()) throw new v("not_ready");
      if (s && (d.revision !== s.revision || d.preferences_key !== s.preferences_key))
        throw new v("refresh_required");
      if (o += new TextEncoder().encode(JSON.stringify(d.items)).byteLength, r.length + d.items.length > 1e4 || o > 32 * 1024 * 1024)
        throw new v("library_page_too_large");
      if (r.push(...d.items), s = d, !d.has_more)
        return {
          ...d,
          items: r,
          offset: 0,
          limit: r.length,
          has_more: !1
        };
      if (!d.items.length) throw new v("refresh_required");
    }
    throw new v("not_ready");
  }
  prepare(e, t, i) {
    return this.prepareCommand(e, `journal/${t}`, i);
  }
  prepareCommand(e, t, i) {
    const s = structuredClone({
      ...i,
      ...b(e),
      type: `${f}/${t}`,
      request_id: ie()
    });
    return { scope: b(e), message: Object.freeze(s) };
  }
  mutate(e) {
    return this.call({ ...e.message });
  }
  async download(e, t, i) {
    const s = `/api/${f}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/export?format=${t}`, r = await this.transport.fetchWithAuth(s, {
      signal: i,
      cache: "no-store",
      redirect: "error"
    });
    if (!r.ok) {
      const o = {
        401: "unauthorized",
        403: "unauthorized",
        404: "not_found",
        413: "export_too_large",
        503: "busy"
      };
      throw new v(o[r.status] ?? "storage_error");
    }
    return qe(
      r,
      na,
      t === "json" ? "application/json" : "application/vnd.sqlite3"
    );
  }
}
function k(n, e, t = `${e}s`) {
  return `${n} ${n === 1 ? e : t}`;
}
function kt(n = 0) {
  const e = Math.floor(n / 60);
  return `${Math.floor(e / 60)}h ${e % 60}m`;
}
function $i(n, e, t = !!e) {
  const i = t ? e?.count : n?.month_viewing_count, s = t ? e?.watchedSeconds : n?.month_watched_seconds;
  return a`<span class=${t ? "calendar-totals-full" : ""}
      >Total Viewings ${n?.viewing_count ?? 0} ·
      ${t ? e?.month ?? "Selected Month" : "This Month"}
      ${i ?? "—"} · Watched Time: Total
      ${kt(n?.watched_seconds)} ·
      ${t ? "Selected Month" : "This Month"}
      ${s === void 0 && t ? "—" : kt(s)}</span
    >
    ${t ? a`<span class="calendar-totals-compact">${i === void 0 ? "— viewings" : k(i, "viewing")} · ${s === void 0 ? "—" : kt(s)} watched</span>` : l}`;
}
function Ci(n, e) {
  return n ? n.error ? a`<span class="error" role="alert"
        >${n.error} <button @click=${e}>Retry month</button></span
      >` : n.loading ? a`<span role="status">Loading month…</span>` : n.empty ? a`<span class="calendar-empty-notice" role="status"
            >No viewings match this month</span
          >` : l : l;
}
function ms(n, e, t, i = !1) {
  const s = new Date(n.started_at), r = Number.isNaN(s.getTime()) ? "—" : s.toLocaleDateString();
  return a`<li
    class=${e === n.id ? "journal-row selected" : "journal-row"}
  >
    <button
      class="link entry-name"
      title=${n.title}
      aria-current=${e === n.id ? "true" : l}
      ?disabled=${i}
      @click=${() => t(n.id)}
    >
      ${n.title}
    </button>
    <time datetime=${n.started_at}>${r}</time
    ><span class="journal-row-status"
      >${n.status === "completed" ? "Completed" : "Partial"}</span
    >
  </li>`;
}
function bs(n, e, t) {
  const i = t ? a`<button type="button" class="link" @click=${t}>
        ${n.title}
      </button>` : n.title;
  return a`<h3 class="journal-title">${i}</h3>
    <dl class="journal-summary">
      <div>
        <dt>Status</dt>
        <dd>${n.status === "completed" ? "Completed" : "Partial"}</dd>
      </div>
      <div>
        <dt>Started</dt>
        <dd>${e(n.started_at)}</dd>
      </div>
      <div>
        <dt>Ended</dt>
        <dd>${e(n.ended_at)}</dd>
      </div>
      <div>
        <dt>Watched</dt>
        <dd>${(n.watched_seconds / 60).toFixed(2)} min</dd>
      </div>
      <div>
        <dt>Runtime</dt>
        <dd>
          ${n.duration_seconds === null ? "—" : `${(n.duration_seconds / 60).toFixed(2)} min`}
        </dd>
      </div>
      <div>
        <dt>Origin</dt>
        <dd>${n.origin === "observed" ? "Recorded" : "Manual"}</dd>
      </div>
    </dl>`;
}
const vs = C`
  .calendar-totals-compact {
    display: none;
  }
  @media (max-width: 700px) {
    .calendar-totals-full,
    .calendar-empty-notice {
      display: none;
    }
    .calendar-totals-compact {
      display: inline;
      white-space: nowrap;
    }
  }
`, ys = C`
  ${vs}
  .journal [hidden] {
    display: none;
  }
  .journal {
    margin-top: 24px;
    overflow: visible;
  }
  .journal-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 16px;
  }
  .journal-toolbar kaleidescape-journal-options {
    margin-left: auto;
  }
  .journal-filters {
    padding: 12px 16px;
    border-block: 1px solid var(--line);
    align-items: end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .journal-filters .journal-toolbar {
    display: contents;
  }
  .journal-filters kaleidescape-journal-options {
    margin-left: auto;
  }
  .journal-filter-tools {
    display: contents;
  }
  .journal-search-input {
    position: relative;
    display: block;
  }
  .journal-search-input input {
    padding-inline-end: 40px;
  }
  .journal-search-input input::-webkit-search-cancel-button {
    display: none;
  }
  .journal-clear-search {
    position: absolute;
    inset-inline-end: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    min-height: 36px;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 22px;
  }
  .journal-search-chip {
    display: none;
  }
  .journal .card-head {
    padding: 0;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .journal .journal-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .journal-movie-filter {
    padding-inline: 20px;
  }
  .journal-row .entry-name {
    min-height: 32px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .journal-row time,
  .journal-row-status {
    white-space: nowrap;
    color: var(--muted);
  }
  .journal-status {
    padding: 12px 20px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
  }
  .journal-title {
    font-size: 20px;
    margin-top: 0;
    overflow-wrap: anywhere;
  }
  .journal-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 20px 0;
  }
  .journal-summary dt {
    color: var(--muted);
    font-size: 12px;
  }
  .journal-summary dd {
    margin: 4px 0 0;
    overflow-wrap: anywhere;
  }
  .journal-notes {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .journal-dialog {
    width: min(860px, calc(100% - 32px));
  }
  .journal-dialog .editor {
    padding: 0;
  }
  .journal-dialog .delete-viewing {
    margin-inline-end: auto;
    order: 0;
  }
  @media (max-width: 700px) {
    .journal-clear-search {
      display: none;
    }
    .journal-search-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100% - 20px);
      margin: 8px 10px 0;
    }
    .journal-search-chip span:first-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .journal-calendar-mode {
      --calendar-sticky-top: calc(
        max(
            var(--companion-sticky-top, 0px),
            var(--companion-viewport-top, 0px),
            env(safe-area-inset-top, 0px)
          ) +
          56px
      );
    }
    .journal-calendar-mode .entries-header {
      top: max(
        var(--companion-sticky-top, 0px),
        var(--companion-viewport-top, 0px),
        env(safe-area-inset-top, 0px)
      );
    }
    .journal-calendar-mode .journal-filters,
    .journal-calendar-mode .journal-toolbar {
      display: contents;
    }
    .journal-calendar-mode .journal-filters > label,
    .journal-calendar-mode .journal-filter-tools,
    .journal-calendar-mode .journal-search-button,
    .journal-calendar-mode .journal-toolbar > button,
    .journal-calendar-mode .journal-movie-filter,
    .journal-calendar-mode .journal-system-details {
      display: none;
    }
    .journal-calendar-mode .entries-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 4px 8px max(4px, env(safe-area-inset-bottom));
      font-size: 11px;
      line-height: 16px;
    }
    .journal-calendar-mode .entries-footer > span {
      min-width: 0;
    }
    .journal-calendar-mode .entries-footer .error {
      white-space: normal;
    }
  }
  @media (max-width: 600px) {
    .journal-summary {
      gap: 10px;
      margin-block: 12px;
    }
    .journal {
      margin-top: 12px;
    }
    .journal-toolbar {
      padding: 8px 10px;
      gap: 8px;
      flex-wrap: nowrap;
    }
    .journal-toolbar button {
      padding-inline: 10px;
      font-size: 13px;
      white-space: nowrap;
    }
    .journal-filters {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      padding: 8px 10px;
    }
    .journal-filters > label:first-child {
      min-width: 0;
      grid-column: 1 / 3;
      grid-row: 1;
    }
    .journal-filters > .journal-search-button {
      grid-column: 3;
      grid-row: 1;
    }
    .journal-filter-tools {
      grid-column: 1 / -1;
      display: flex;
      align-items: end;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .journal-filter-tools > * {
      flex: 0 0 auto;
    }
    .journal-filter-tools select {
      max-width: 170px;
    }
    .journal-title {
      font-size: 18px;
    }
  }
`, la = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20type='positive'%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(1.33,%200)'%3e%3cg%20transform='translate(0,%2016.27)'%3e%3cmask%20id='mask-2'%20fill='white'%3e%3cpolygon%20points='0.000109100102%200.246970954%2077.0827837%200.246970954%2077.0827837%2063.7145228%200.000109100102%2063.7145228'%3e%3c/polygon%3e%3c/mask%3e%3cpath%20d='M77.0137759,27.0426556%20C76.2423237,14.6741909%2069.9521992,5.42041494%2060.4876349,0.246970954%20C60.5414108,0.548381743%2060.273195,0.925145228%2059.9678008,0.791701245%20C53.7772614,-1.91634855%2043.2753527,6.84780083%2035.9365975,2.25825726%20C35.9917012,3.90539419%2035.6700415,11.940249%2024.3515353,12.4063071%20C24.0843154,12.4172614%2023.9372614,12.1443983%2024.1062241,11.9512033%20C25.619917,10.2247303%2027.1482158,5.85360996%2024.9507054,3.5233195%20C20.2446473,7.74041494%2017.5117012,9.32746888%208.48829876,7.23319502%20C2.71103734,13.2740249%20-0.562655602,21.5419087%200.08,31.8413278%20C1.39120332,52.86639%2021.0848133,64.8846473%2040.9165145,63.6471369%20C60.746888,62.4106224%2078.3253112,48.0677178%2077.0137759,27.0426556'%20fill='%23FA320A'%20mask='url(%23mask-2)'%3e%3c/path%3e%3c/g%3e%3cpath%20d='M40.8717012,11.4648963%20C44.946722,10.49361%2056.6678838,11.3702905%2060.4232365,16.3518672%20C60.6486307,16.6506224%2060.3312863,17.2159336%2059.9678008,17.0572614%20C53.7772614,14.3492116%2043.2753527,23.113361%2035.9365975,18.5238174%20C35.9917012,20.1709544%2035.6700415,28.2058091%2024.3515353,28.6718672%20C24.0843154,28.6828216%2023.9372614,28.4099585%2024.1062241,28.2167635%20C25.619917,26.4902905%2027.1478838,22.1191701%2024.9507054,19.7888797%20C19.8243983,24.3827386%2017.0453112,25.8589212%205.91900415,22.8514523%20C5.55485477,22.753195%205.67900415,22.1679668%206.06639004,22.020249%20C8.16929461,21.2165975%2012.933444,17.6965975%2017.4406639,16.1450622%20C18.2987552,15.8499585%2019.1541909,15.6209129%2019.9890456,15.4878008%20C15.02639,15.0443154%2012.7893776,14.3541909%209.63286307,14.8302075%20C9.28697095,14.8823237%209.05195021,14.479668%209.26639004,14.2034855%20C13.5193361,8.7253112%2021.3540249,7.07087137%2026.1878838,9.98107884%20C23.2082988,6.28912863%2020.8743568,3.34473029%2020.8743568,3.34473029%20L26.4046473,0.203485477%20C26.4046473,0.203485477%2028.6894606,5.30821577%2030.3518672,9.02340249%20C34.4657261,2.94506224%2042.119834,2.38406639%2045.3536929,6.69676349%20C45.5455602,6.95302905%2045.3450622,7.31751037%2045.0247303,7.30987552%20C42.3926971,7.24580913%2040.9434025,9.63983402%2040.833527,11.4605809%20L40.8717012,11.4648963'%20fill='%2300912D'%3e%3c/path%3e%3c/g%3e%3c/svg%3e", da = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20type='negative'%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(0,%201.23)'%3e%3cg%3e%3cmask%20id='mask-2'%20fill='white'%3e%3cpolygon%20points='0%200.161950465%2079.7417075%200.161950465%2079.7417075%2077.522807%200%2077.522807'%3e%3c/polygon%3e%3c/mask%3e%3cpath%20d='M71.4638596,70.225614%20C56.3459649,71.0192982%2053.2568421,53.7203509%2047.325614,53.8435088%20C44.7982456,53.8964912%2042.8063158,56.5389474%2043.6810526,59.6185965%20C44.1621053,61.3115789%2045.4964912,63.794386%2046.337193,65.3350877%20C49.302807,70.7719298%2044.9185965,76.9245614%2039.7880702,77.4449123%20C31.2621053,78.3098246%2027.705614,73.3638596%2027.925614,68.3007018%20C28.1729825,62.6168421%2032.9922807,56.8091228%2028.0494737,54.3378947%20C22.8694737,51.7480702%2018.6585965,61.8754386%2013.7017544,64.1357895%20C9.2154386,66.1817544%202.9877193,64.5954386%200.773684211,59.6136842%20C-0.781403509,56.1129825%20-0.498596491,49.3722807%206.42526316,46.8003509%20C10.7501754,45.1940351%2020.3880702,48.9010526%2020.8824561,44.205614%20C21.4522807,38.7929825%2010.7575439,38.3364912%207.53754386,37.0385965%20C1.84,34.7424561%20-1.52280702,29.8291228%201.11192982,24.5582456%20C3.08877193,20.6045614%208.90526316,18.9957895%2013.3449123,20.7277193%20C18.6635088,22.8024561%2019.517193,28.3189474%2022.2421053,30.6129825%20C24.5894737,32.5901754%2027.8021053,32.8375439%2029.9031579,31.4782456%20C31.4526316,30.4754386%2031.9684211,28.2729825%2031.3838596,26.2610526%20C30.6084211,23.5901754%2028.5505263,21.9235088%2026.542807,20.2905263%20C22.9698246,17.3859649%2017.925614,14.8884211%2020.9768421,6.96035088%20C23.4778947,0.463157895%2030.8133333,0.229122807%2030.8133333,0.229122807%20C33.7277193,-0.0985964912%2036.3375439,0.781403509%2038.4642105,2.68140351%20C41.3073684,5.22140351%2041.8610526,8.61649123%2041.3852632,12.2385965%20C40.9505263,15.5449123%2039.7803509,18.4407018%2039.1701754,21.7164912%20C38.4621053,25.5196491%2040.4947368,29.3519298%2044.3603509,29.5010526%20C49.4449123,29.6975439%2050.9694737,25.7894737%2051.5915789,23.3122807%20C52.5024561,19.6877193%2053.6978947,16.322807%2057.0617544,14.2035088%20C61.8894737,11.1617544%2068.5954386,11.8284211%2071.7066667,17.674386%20C74.1677193,22.3%2073.3775439,28.6677193%2069.6024561,32.1449123%20C67.9087719,33.7045614%2065.8722807,34.254386%2063.6694737,34.2698246%20C60.5105263,34.2922807%2057.3529825,34.2147368%2054.4207018,35.6929825%20C52.4245614,36.6989474%2051.5547368,38.3382456%2051.5550877,40.5354386%20C51.5550877,42.6768421%2052.6698246,44.0754386%2054.4761404,44.985614%20C57.8782456,46.7003509%2061.6336842,47.0508772%2065.3087719,47.694386%20C70.6382456,48.6277193%2075.3242105,50.5049123%2078.3326316,55.4505263%20C78.3596491,55.4940351%2078.3859649,55.5378947%2078.4115789,55.5821053%20C81.8666667,61.4375439%2078.2533333,69.8687719%2071.4638596,70.225614'%20fill='%230AC855'%20mask='url(%23mask-2)'%3e%3c/path%3e%3c/g%3e%3c/g%3e%3c/svg%3e", ca = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(10.1,%200)'%3e%3cg%3e%3cmask%20id='mask-2'%20fill='white'%3e%3cpolygon%20points='0.0178438662%200.124907063%2059.6019307%200.124907063%2059.6019307%2079.9821561%200.0178438662%2079.9821561'%3e%3c/polygon%3e%3c/mask%3e%3cpath%20d='M2.53115242,19.0988848%20C2.76163569,23.9952416%2014.8892193,27.8762825%2029.8007435,27.7912268%20C42.8237918,27.7168773%2053.6874349,24.6411896%2056.3485502,20.6004461%20C55.7421561,19.9265428%2054.904684,19.4643866%2053.9613383,19.3391822%20C53.9714498,19.220223%2053.9779926,19.1003717%2053.9773978,18.9787361%20C53.9663941,17.0423792%2052.5460223,15.4477323%2050.695316,15.1503346%20C50.7440892,14.8999257%2050.7696654,14.6408922%2050.7681784,14.3759108%20C50.7559851,12.2194796%2048.9977695,10.481487%2046.8413383,10.4936803%20C46.7925651,10.4939777%2046.7449814,10.4999257%2046.6965056,10.5020074%20C46.8344981,10.0987361%2046.9118216,9.66780669%2046.9094424,9.21784387%20C46.8969517,7.06141264%2045.1390335,5.32342007%2042.9826022,5.33561338%20C42.4877323,5.33858736%2042.0169517,5.43702602%2041.5821561,5.60743494%20C40.9653532,4.44639405%2039.7811152,3.63717472%2038.4002974,3.54379182%20C38.1597026,1.60743494%2036.5055762,0.113605948%2034.506171,0.124843367%20C33.247881,0.13204461%2032.1350186,0.736356877%2031.4263197,1.66453532%20C30.7075093,0.882379182%2029.6773234,0.391672862%2028.5314498,0.398215613%20C26.3750186,0.410408922%2024.637026,2.16862454%2024.6492193,4.32475836%20C24.6515985,4.73665428%2024.718513,5.13249071%2024.8386617,5.50453532%20C23.9586617,5.66780669%2023.1848327,6.12520446%2022.6191822,6.77144981%20C22.1701115,5.09888476%2020.642974,3.86973978%2018.8297398,3.8798513%20C17.1357621,3.88966543%2015.7040892,4.97873606%2015.172342,6.48981413%20C13.7332342,7.07182156%2012.7202974,8.48356877%2012.7298141,10.1302602%20C12.7318959,10.4960595%2012.7878067,10.8481784%2012.8838662,11.1836431%20C12.398513,10.9713011%2011.8634944,10.852342%2011.2996283,10.8556134%20C9.5994052,10.8654275%208.16327138,11.9622305%207.63598513,13.4822305%20C7.13040892,13.2472862%206.56832714,13.1137546%205.973829,13.1173234%20C3.81739777,13.1295167%202.07910781,14.8874349%202.09153162,17.0438662%20C2.09546468,17.7549442%202.29263941,18.4187361%202.62810409,18.9909294%20C2.59390335,19.0254275%202.56386617,19.063197%202.53115242,19.0988848'%20fill='%23F9D320'%20mask='url(%23mask-2)'%3e%3c/path%3e%3cpath%20d='M50.9736803,68.1576208%20C49.8275093,69.89829%2047.6002974,71.7008178%2045.2692937,72.9026022%20L49.2541264,32.4853532%20C51.7894424,31.6707807%2054.2634944,30.5915242%2056.085948,29.0438662%20L50.9736803,68.1576208%20Z%20M41.3037918,74.5885502%20C37.4450558,75.8655762%2035.201487,76.2614126%2031.9895911,76.5766543%20L32.4901115,35.0432714%20C36.0383643,34.9415613%2040.6301859,34.4606691%2044.5427509,33.6255762%20L41.3037918,74.5885502%20Z%20M18.29829,74.5885502%20L15.0596283,33.6255762%20C18.9718959,34.4606691%2023.5637175,34.9415613%2027.1119703,35.0432714%20L27.6124907,76.5766543%20C24.4005948,76.2614126%2022.1573234,75.8655762%2018.29829,74.5885502%20Z%20M8.62869888,68.1576208%20L3.51613383,29.0438662%20C5.33858736,30.5915242%207.81263941,31.6707807%2010.3479554,32.4853532%20L14.3327881,72.9026022%20C12.0017844,71.7008178%209.77457249,69.89829%208.62869888,68.1576208%20Z%20M50.687881,13.6110037%20C50.7384387,13.8578439%2050.7666914,14.1130112%2050.7681784,14.3750186%20C50.7696654,14.64%2050.7440892,14.8990335%2050.6950186,15.1494424%20C52.5460223,15.4465428%2053.9663941,17.0411896%2053.9773978,18.9778439%20C53.9779926,19.0991822%2053.9714498,19.2193309%2053.9613383,19.3379926%20C54.904684,19.463197%2055.7421561,19.9253532%2056.3485502,20.5992565%20C53.6877323,24.6402974%2042.8237918,27.7159851%2029.8010409,27.790632%20C14.8895167,27.8759851%202.76193309,23.9952416%202.53115242,19.0985874%20C2.56386617,19.063197%202.59390335,19.0251301%202.62810409,18.9909294%20C2.39791822,18.5983643%202.23910781,18.1608922%202.15702602,17.6966543%20C0.729219331,19.0518959%20-0.13472119,20.1445353%200.0172490706,21.7356134%20C0.0318215613,21.9482528%206.3339777,67.0709294%206.3339777,67.0709294%20C7.06111524,74.2173978%2017.4388104,79.9292193%2029.8010409,80%20C42.1632714,79.9292193%2052.5412639,74.2173978%2053.2681041,67.0709294%20C53.2681041,67.0709294%2059.5702602,21.9482528%2059.5848327,21.7356134%20C59.8866914,18.5531599%2056.162974,15.6642379%2050.687881,13.6110037%20L50.687881,13.6110037%20Z'%20fill='%23DB382A'%20mask='url(%23mask-2)'%3e%3c/path%3e%3c/g%3e%3cpath%20d='M15.0596283,33.6255762%20L18.29829,74.5885502%20C22.1573234,75.8655762%2024.4005948,76.2614126%2027.6124907,76.5766543%20L27.1119703,35.0432714%20C23.5637175,34.9415613%2018.9718959,34.4606691%2015.0596283,33.6255762'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M31.9895911,76.5766543%20C35.201487,76.2614126%2037.4447584,75.8655762%2041.3037918,74.5885502%20L44.5424535,33.6255762%20C40.6301859,34.4606691%2036.0383643,34.9415613%2032.4901115,35.0432714%20L31.9895911,76.5766543'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M45.2692937,72.9026022%20C47.6002974,71.7008178%2049.8275093,69.89829%2050.9733829,68.1576208%20L56.085948,29.0438662%20C54.2634944,30.5915242%2051.7894424,31.6707807%2049.2541264,32.4853532%20L45.2692937,72.9026022'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M3.51613383,29.0438662%20L8.62840149,68.1576208%20C9.77457249,69.89829%2012.0017844,71.7008178%2014.3327881,72.9026022%20L10.3479554,32.4853532%20C7.81263941,31.6707807%205.33858736,30.5915242%203.51613383,29.0438662'%20fill='%23FFFFFE'%3e%3c/path%3e%3c/g%3e%3c/svg%3e", ha = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(0,%2012.46)'%3e%3cg%3e%3cpath%20d='M45.4780328,39.6152131%20C45.9506885,38.4445902%2047.6259672,37.7314098%2048.8288525,37.8148197%20C50.114623,37.904%2051.4803934,39.2556066%2051.719082,40.584918%20C51.7634098,40.5366557%2051.8098361,40.4910164%2051.8570492,40.4461639%20C52.2699016,40.0516721%2052.7871475,39.7899016%2053.3531803,39.7177705%20C53.266623,39.3342951%2053.2459016,38.9238033%2053.3051803,38.5025574%20C53.5142295,37.0205902%2054.7034754,35.9092459%2056.0650492,35.9202623%20C56.9437377,35.9273443%2057.714623,36.376918%2058.216918,37.067541%20C58.2617705,37.0114098%2058.3113443,36.96%2058.3596066,36.907541%20C58.9340328,33.9152787%2059.2980984,30.5345574%2059.3809836,26.9468852%20C59.6655738,14.6103607%2056.5356066,4.53193443%2052.3902951,4.43645902%20C48.2447213,4.34072131%2044.653377,14.2638689%2044.3687869,26.6003934%20C44.3687869,26.6003934%2044.1492459,31.1000656%2045.4780328,39.6152131'%20id='Fill-1'%20fill='%23185A30'%3e%3c/path%3e%3cpath%20d='M73.5446557,53.1058361%20C73.7896393,52.696918%2073.9265574,52.2066885%2073.9171148,51.6857705%20C73.9965902,50.002623%2072.8411803,48.4768525%2071.2335738,48.6457705%20C71.28,48.4532459%2071.3104262,48.2531148%2071.3222295,48.0466885%20C71.4184918,46.3606557%2070.2557377,44.907541%2068.7249836,44.8013115%20C68.6914098,44.7992131%2068.6583607,44.7981639%2068.6250492,44.7971148%20C68.7842623,44.3787541%2068.8632131,43.9116066%2068.8351475,43.4166557%20C68.7559344,42.0139016%2067.7885902,40.832%2066.5300984,40.5993443%20C66.075541,40.5154098%2065.634623,40.5571148%2065.2309508,40.696918%20C64.8495738,39.757377%2064.0487869,39.060459%2063.074623,38.9133115%20C62.9975082,37.3878033%2061.8956066,36.1321967%2060.4768525,36.0338361%20C59.5847869,35.9719344%2058.7651148,36.3816393%2058.216918,37.067541%20C57.714623,36.376918%2056.9437377,35.9276066%2056.0650492,35.9204395%20C54.7034754,35.9092459%2053.5142295,37.0205902%2053.3051803,38.5028197%20C53.2459016,38.9238033%2053.266623,39.3342951%2053.3531803,39.7180328%20C52.7871475,39.7899016%2052.2699016,40.0519344%2051.8570492,40.4461639%20C51.8098361,40.4910164%2051.7634098,40.5366557%2051.719082,40.584918%20C51.4803934,39.2556066%2050.114623,37.9042623%2048.8288525,37.8148197%20C47.6259672,37.7314098%2045.928918,38.4621639%2045.4780328,39.6152131%20C45.6758033,41.6259672%2046.9327213,47.1071475%2051.4788197,52.0241311%20L51.5192131,52.0270164%20C51.9575082,52.4236066%2052.5298361,52.6420984%2053.1399344,52.5878033%20C53.5181639,52.5539672%2053.8664918,52.418623%2054.1665574,52.2098361%20L54.2397377,52.2148197%20C54.6397377,52.4925902%2055.1205246,52.6379016%2055.6285902,52.5927869%20C55.8226885,52.5754754%2056.0078689,52.5287869%2056.1838689,52.4621639%20C56.6192787,53.3623607%2057.5902951,53.9441311%2058.6740984,53.8486557%20C59.5134426,53.7746885%2060.2268852,53.3104262%2060.6462951,52.6570492%20L60.7821639,52.6664918%20C61.2010492,53.0817049%2061.7579016,53.323541%2062.3585574,53.3054426%20C62.855082,54.0566557%2063.767082,54.5188197%2064.7735082,54.4304262%20C65.1525246,54.3971148%2065.5063607,54.2874754%2065.8219016,54.1214426%20C66.3483279,54.7690492%2067.2123279,55.1540984%2068.1602623,55.0706885%20C69.0974426,54.9885902%2069.8890492,54.4689836%2070.3197377,53.7505574%20C70.7428197,54.0902295%2071.272918,54.2725246%2071.8358033,54.2224262%20C72.3819016,54.1736393%2072.8671475,53.9158033%2073.2317377,53.5257705%20L73.2925902,53.5299672%20C73.3754754,53.4098361%2073.4462951,53.2868197%2073.5121311,53.1627541%20C73.5137049,53.1603934%2073.5150164,53.1577705%2073.5163279,53.1554098%20C73.5252459,53.1388852%2073.5362623,53.122623%2073.5446557,53.1058361'%20fill='%23F9D320'%3e%3c/path%3e%3cpath%20d='M42.2090492,9.21232787%20L6.56209836,12.7268197%20C7.62203279,10.6709508%209.21206557,8.70662295%2010.7472787,7.6957377%20L45.2440656,3.18662295%20C43.8793443,4.79422951%2042.9272131,6.9762623%2042.2090492,9.21232787%20Z%20M45.2440656,49.5517377%20L10.7472787,45.042623%20C9.21206557,44.032%207.62203279,42.0674098%206.56209836,40.0118033%20L42.2090492,43.5262951%20C42.9272131,45.7620984%2043.8793443,47.9443934%2045.2440656,49.5517377%20Z%20M5.07514754,36.5143607%20C3.94885246,33.1108197%203.6,31.1323279%203.32170492,28.2992787%20L39.9527869,28.7409836%20C40.0427541,31.8701639%2040.4668852,35.9202623%2041.2031475,39.3707541%20L5.07514754,36.5143607%20Z%20M5.07514754,16.224%20L41.2031475,13.3676066%20C40.4668852,16.8180984%2040.0427541,20.8681967%2039.9527869,23.9976393%20L3.32170492,24.439082%20C3.6,21.6062951%203.94885246,19.627541%205.07514754,16.224%20Z%20M56.7186885,3.84865574%20C54.4333115,1.18767213%2052.7926557,-0.0616393443%2051.3872787,0.100721311%20C51.1252459,0.134032787%2011.4032787,5.67213115%2011.4032787,5.67213115%20C5.10006557,6.31318033%200.0624262295,15.4659672%200,26.3693115%20C0.0624262295,37.2723934%205.10006557,46.4251803%2011.4032787,47.0664918%20C11.4032787,47.0664918%2051.1997377,52.6247869%2051.3872787,52.6376393%20C51.7196066,52.635541%2052.0477377,52.5909508%2052.3711475,52.5080656%20C52.0563934,52.4144262%2051.7660328,52.2504918%2051.5192131,52.0270164%20L51.4788197,52.0241311%20C46.9327213,47.1074098%2045.6758033,41.6259672%2045.4780328,39.6152131%20C45.4785574,39.6136393%2045.4796066,39.6123279%2045.4801311,39.6107541%20C45.4796066,39.6123279%2045.4785574,39.6136393%2045.4780328,39.6152131%20C44.1492459,31.1000656%2044.3687869,26.6003934%2044.3687869,26.6003934%20C44.653377,14.2638689%2048.2447213,4.34072131%2052.3902951,4.43619672%20C56.5356066,4.53193443%2059.6655738,14.6103607%2059.3809836,26.9468852%20C59.2980984,30.5345574%2058.9340328,33.9152787%2058.3596066,36.907541%20C58.9497705,36.2562623%2059.741377,35.9819016%2060.4768525,36.0338361%20C60.6121967,36.043541%2060.7438689,36.0663607%2060.872918,36.096%20C63.3904262,22.3210492%2060.7512131,8.87029508%2056.7186885,3.84865574%20L56.7186885,3.84865574%20Z'%20fill='%23129B47'%3e%3c/path%3e%3c/g%3e%3cpath%20d='M41.2031475,13.3676066%20L5.07514754,16.224%20C3.94885246,19.627541%203.6,21.6062951%203.32170492,24.439082%20L39.9527869,23.997377%20C40.0427541,20.8681967%2040.4668852,16.8180984%2041.2031475,13.3676066'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M45.2440656,3.18662295%20L10.7472787,7.6957377%20C9.21206557,8.70662295%207.62203279,10.6709508%206.56209836,12.7268197%20L42.2090492,9.21232787%20C42.9272131,6.9762623%2043.8793443,4.79422951%2045.2440656,3.18662295'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M6.56209836,40.011541%20C7.62203279,42.0674098%209.21206557,44.032%2010.7472787,45.042623%20L45.2440656,49.5517377%20C43.8793443,47.9443934%2042.9272131,45.7620984%2042.2090492,43.5262951%20L6.56209836,40.011541'%20fill='%23FFFFFE'%3e%3c/path%3e%3cg%20transform='translate(3.15,%2028)'%3e%3cpath%20d='M36.8052459,0.675409836%20L0.174163934,0.233704918%20C0.452459016,3.0664918%200.801311475,5.0452459%201.92760656,8.44878689%20L38.0556066,11.3051803%20C37.3193443,7.85468852%2036.8952131,3.80459016%2036.8052459,0.675409836'%20fill='%23FFFFFE'%3e%3c/path%3e%3c/g%3e%3c/g%3e%3c/svg%3e";
function pa(n) {
  const e = n.enrichment ?? {}, t = e.reviewed;
  return [
    {
      kind: "viewer",
      label: "TMDB viewer rating",
      value: n.ratings ? n.ratings.audience_rating : t?.audience_rating ?? e.tmdb?.audience_rating,
      max: 10
    },
    {
      kind: "critic",
      label: "Rotten Tomatoes critics",
      value: n.ratings ? n.ratings.critic_score : t?.critic_score ?? e.kaleidescape?.critic_score,
      max: 100
    },
    {
      kind: "audience",
      label: "Rotten Tomatoes audience",
      value: n.ratings ? n.ratings.audience_score : t?.audience_score ?? e.kaleidescape?.audience_score,
      max: 100
    }
  ].filter(
    ({ value: i, max: s }) => typeof i == "number" && Number.isFinite(i) && i >= 0 && i <= s
  );
}
function ua(n) {
  const e = n ? pa(n) : [];
  return e.length ? a`<div
    class="movie-ratings"
    slot="collection"
    aria-label="Viewer and critic ratings"
  >
    ${e.map(({ kind: t, label: i, value: s, max: r }) => {
    const o = Math.round(s / r * 100), d = t === "critic" ? o >= 60 ? la : da : o >= 60 ? ca : ha;
    return a`<span
        class=${`score-chip score-${t}`}
        title=${`${i}: ${o}%`}
        aria-label=${`${i}: ${o}%${r === 10 ? ` (${s}/10)` : ""}`}
      >
        ${t === "viewer" ? a`<svg
                class="score-ring"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <circle cx="24" cy="24" r="23" fill="#081c22" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke=${o >= 70 ? "#204529" : o >= 40 ? "#423d0f" : "#571435"}
                  stroke-width="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke=${o >= 70 ? "#21d07a" : o >= 40 ? "#d2d531" : "#db2360"}
                  stroke-width="3"
                  stroke-linecap="round"
                  pathLength="100"
                  stroke-dasharray=${`${o} 100`}
                  transform="rotate(-90 24 24)"
                />
                <text x="24" y="29" text-anchor="middle" fill="white">
                  ${o}
                  <tspan font-size="7" dy="-4">%</tspan>
                </text>
              </svg>` : a`<img src=${d} alt="" width="30" height="30" /><span
                  >${o}%</span
                >`}
      </span>`;
  })}
  </div>` : l;
}
const ga = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20viewBox='0%200%20273.42%2035.52'%3e%3cdefs%3e%3cstyle%3e.cls-1{fill:url(%23linear-gradient);}%3c/style%3e%3clinearGradient%20id='linear-gradient'%20y1='17.76'%20x2='273.42'%20y2='17.76'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='0'%20stop-color='%2390cea1'/%3e%3cstop%20offset='0.56'%20stop-color='%233cbec9'/%3e%3cstop%20offset='1'%20stop-color='%2300b3e5'/%3e%3c/linearGradient%3e%3c/defs%3e%3ctitle%3eAsset%203%3c/title%3e%3cg%20id='Layer_2'%20data-name='Layer%202'%3e%3cg%20id='Layer_1-2'%20data-name='Layer%201'%3e%3cpath%20class='cls-1'%20d='M191.85,35.37h63.9A17.67,17.67,0,0,0,273.42,17.7h0A17.67,17.67,0,0,0,255.75,0h-63.9A17.67,17.67,0,0,0,174.18,17.7h0A17.67,17.67,0,0,0,191.85,35.37ZM10.1,35.42h7.8V6.92H28V0H0v6.9H10.1Zm28.1,0H46V8.25h.1L55.05,35.4h6L70.3,8.25h.1V35.4h7.8V0H66.45l-8.2,23.1h-.1L50,0H38.2ZM89.14.12h11.7a33.56,33.56,0,0,1,8.08,1,18.52,18.52,0,0,1,6.67,3.08,15.09,15.09,0,0,1,4.53,5.52,18.5,18.5,0,0,1,1.67,8.25,16.91,16.91,0,0,1-1.62,7.58,16.3,16.3,0,0,1-4.38,5.5,19.24,19.24,0,0,1-6.35,3.37,24.53,24.53,0,0,1-7.55,1.15H89.14Zm7.8,28.2h4a21.66,21.66,0,0,0,5-.55A10.58,10.58,0,0,0,110,26a8.73,8.73,0,0,0,2.68-3.35,11.9,11.9,0,0,0,1-5.08,9.87,9.87,0,0,0-1-4.52,9.17,9.17,0,0,0-2.63-3.18A11.61,11.61,0,0,0,106.22,8a17.06,17.06,0,0,0-4.68-.63h-4.6ZM133.09.12h13.2a32.87,32.87,0,0,1,4.63.33,12.66,12.66,0,0,1,4.17,1.3,7.94,7.94,0,0,1,3,2.72,8.34,8.34,0,0,1,1.15,4.65,7.48,7.48,0,0,1-1.67,5,9.13,9.13,0,0,1-4.43,2.82V17a10.28,10.28,0,0,1,3.18,1,8.51,8.51,0,0,1,2.45,1.85,7.79,7.79,0,0,1,1.57,2.62,9.16,9.16,0,0,1,.55,3.2,8.52,8.52,0,0,1-1.2,4.68,9.32,9.32,0,0,1-3.1,3A13.38,13.38,0,0,1,152.32,35a22.5,22.5,0,0,1-4.73.5h-14.5Zm7.8,14.15h5.65a7.65,7.65,0,0,0,1.78-.2,4.78,4.78,0,0,0,1.57-.65,3.43,3.43,0,0,0,1.13-1.2,3.63,3.63,0,0,0,.42-1.8A3.3,3.3,0,0,0,151,8.6a3.42,3.42,0,0,0-1.23-1.13A6.07,6.07,0,0,0,148,6.9a9.9,9.9,0,0,0-1.85-.18h-5.3Zm0,14.65h7a8.27,8.27,0,0,0,1.83-.2,4.67,4.67,0,0,0,1.67-.7,3.93,3.93,0,0,0,1.23-1.3,3.8,3.8,0,0,0,.47-1.95,3.16,3.16,0,0,0-.62-2,4,4,0,0,0-1.58-1.18,8.23,8.23,0,0,0-2-.55,15.12,15.12,0,0,0-2.05-.15h-5.9Z'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e";
function ws() {
  return a`<a
      href="https://www.themoviedb.org"
      target="_blank"
      rel="noopener noreferrer"
      ><img src=${ga} alt="TMDB" width="100"
    /></a>
    <p class="muted">
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>`;
}
function fa(n, e, t = 8) {
  const i = [
    ["Full cast", n.actors.length > t ? n.actors : []],
    ["Writers", n.writers],
    ["Producers", n.producers ?? []],
    ["Studios", n.studios]
  ];
  return a`${i.some(([, s]) => s?.length) ? a`<details class="extra-credits">
          <summary>More credits</summary>
          <dl class="movie-credits">
            ${i.map(
    ([s, r]) => r?.length ? a`<div>
                    <dt>${s}</dt>
                    <dd>
                      ${r.map((o, d) => a`<span class="credit-name">${e(o, o + (d < r.length - 1 ? "," : ""))}</span>${d < r.length - 1 ? " " : ""}`)}
                    </dd>
                  </div>` : l
  )}
          </dl>
        </details>` : l}
  ${n.enrichment && Object.keys(n.enrichment).length ? a`<details class="metadata-scores">
          <summary>Ratings and metadata sources</summary>
          ${Object.entries(n.enrichment).map(([s, r]) => a`<p class="muted">${s === "reviewed" ? "Reviewed metadata" : s === "tmdb" ? "TMDB" : "Kaleidescape store"}${r.critic_score != null ? a` · Rotten Tomatoes critics ${r.critic_score}%` : l}${r.audience_score != null ? a` · Rotten Tomatoes audience ${r.audience_score}%` : l}${r.audience_rating != null ? a` · TMDB audience ${r.audience_rating}/10 (${k(r.audience_votes ?? 0, "vote")})` : l}${r.distributor ? a` · Distributor: ${r.distributor}` : l}</p>`)}
          ${n.enrichment.tmdb || n.enrichment.reviewed?.providers?.includes("tmdb") ? ws() : l}
        </details>` : l}`;
}
class ma {
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
      const r = [...this.entries.keys()], o = r.find(
        (d) => ![...this.readers.get(d) ?? []].some(
          (c) => c.visible()
        )
      ) ?? r[0];
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
class T {
  constructor() {
    this.cache = new ma(), this.active = 0, this.waiting = [];
  }
  acquire(e) {
    return new Promise((t, i) => {
      const s = () => {
        this.waiting = this.waiting.filter((o) => o !== r), i(new DOMException("Aborted", "AbortError"));
      }, r = () => {
        e.removeEventListener("abort", s), this.active++;
        let o = !1;
        t(() => {
          o || (o = !0, this.active--, this.waiting.shift()?.());
        });
      };
      if (e.aborted) return s();
      this.active < 3 ? r() : (this.waiting.push(r), e.addEventListener("abort", s, { once: !0 }));
    });
  }
}
const Ne = class Ne extends x {
  constructor() {
    super(...arguments), this.fit = "cover", this.title = "", this.visible = !1, this.generation = 0, this.visibility = () => {
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
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.observer?.disconnect(), this.visible = !1, this.clear(), this.requestUpdate();
  }
  willUpdate(e) {
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
    this.cancelLoad(), this.unwatch?.(), this.unwatch = void 0, this.url = void 0;
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
    let s, r;
    try {
      if (s = await this.queue.acquire(i.signal), i.signal.aborted) return;
      const o = this.queue.cache.get(this.cacheKey);
      if (o) {
        this.url = o, this.requestUpdate();
        return;
      }
      r = setTimeout(() => i.abort(), 5e3);
      const d = await this.client.libraryArtwork(
        this.scope,
        this.artworkKey,
        i.signal
      );
      if (t !== this.generation || i.signal.aborted || !this.isConnected || document.hidden)
        return;
      this.url = this.queue.cache.put(this.cacheKey, d), this.requestUpdate();
    } catch (o) {
      t === this.generation && g(o) === "unauthorized" && this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      );
    } finally {
      clearTimeout(r), s?.(), t === this.generation && (this.controller = void 0);
    }
  }
  render() {
    return this.url ? a`<img
          src=${this.url}
          alt=${`Cover for ${this.title}`}
          style=${`object-fit: ${this.fit}`}
          @error=${() => this.queue?.cache.drop(this.cacheKey)}
        />` : a`<span>No cached artwork</span>`;
  }
};
Ne.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  queue: { attribute: !1 },
  artworkKey: { attribute: !1 },
  fit: { type: String },
  title: { type: String }
}, Ne.styles = C`
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
let Ut = Ne;
customElements.get("kaleidescape-library-cover") || customElements.define("kaleidescape-library-cover", Ut);
const Fe = class Fe extends x {
  constructor() {
    super(...arguments), this.plan = "", this.choice = "", this.visible = !1, this.url = "", this.failed = !1;
  }
  connectedCallback() {
    super.connectedCallback(), this.observer = new IntersectionObserver((e) => {
      this.visible = e.some((t) => t.isIntersecting), this.visible && this.load();
    }), this.observer.observe(this);
  }
  willUpdate(e) {
    ["client", "scope", "plan", "choice"].some((t) => e.has(t)) && (this.clear(), this.load());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.observer?.disconnect(), this.clear();
  }
  clear() {
    this.controller?.abort(), this.controller = void 0, this.url && URL.revokeObjectURL(this.url), this.url = "", this.failed = !1;
  }
  async load() {
    if (!this.client || !this.scope || !this.queue || !this.visible || !this.isConnected || this.url || this.controller)
      return;
    const e = this.controller = new AbortController();
    let t, i;
    try {
      if (t = await this.queue.acquire(e.signal), e.signal.aborted) return;
      i = setTimeout(() => e.abort(), 8e4);
      const s = await this.client.titleScrapeImage(
        this.scope,
        this.plan,
        this.choice,
        e.signal
      );
      !e.signal.aborted && this.isConnected && (this.url = URL.createObjectURL(s));
    } catch (s) {
      e.signal.aborted || (this.failed = !0, g(s) === "unauthorized" && this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      ));
    } finally {
      clearTimeout(i), t?.(), this.controller === e && (this.controller = void 0, this.url || (this.failed = !0)), this.requestUpdate();
    }
  }
  render() {
    return this.url ? a`<img src=${this.url} alt="" />` : a`<span
          >${this.failed ? "Preview unavailable" : "Loading preview…"}</span
        >`;
  }
};
Fe.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  queue: { attribute: !1 },
  plan: {},
  choice: {}
}, Fe.styles = C`
    :host {
      display: grid;
      place-items: center;
      overflow: hidden;
      background: var(--secondary-background-color, #222);
      border-radius: 8px;
      position: relative;
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    span {
      font: 12px system-ui;
      padding: 8px;
    }
  `;
let Tt = Fe;
customElements.get("kaleidescape-scrape-image") || customElements.define("kaleidescape-scrape-image", Tt);
function Vi(n) {
  if (n)
    try {
      const e = new URL(n);
      return e.protocol === "https:" && !e.username && !e.password && !e.port && !e.search && !e.hash ? e.href : void 0;
    } catch {
      return;
    }
}
const Ve = class Ve extends x {
  constructor() {
    super(...arguments), this.versionId = "", this.blocked = !1, this.matchMode = "refresh", this.matchProvider = "", this.query = "", this.year = "", this.sourceExpected = {}, this.artworkExpected = {
      poster: !0,
      backdrop: !0
    }, this.fieldSources = {}, this.initialSources = {}, this.mappingTouched = !1, this.imageChoice = "", this.imagePage = 0, this.providerDrafts = {}, this.imageDraft = {}, this.resetDraft = /* @__PURE__ */ new Set(), this.busy = !1, this.error = "", this.hints = /* @__PURE__ */ new Set(), this.generation = 0, this.view = "sources", this.queue = new T();
  }
  get writePending() {
    return !!this.pending;
  }
  get hasDraft() {
    return !!Object.keys(this.providerDrafts).length || !!Object.keys(this.imageDraft).length || !!this.resetDraft.size || this.mappingTouched || this.changedExpectations();
  }
  willUpdate(e) {
    ["client", "scope", "versionId"].some((t) => e.has(t)) && this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.reset();
  }
  mainDialog() {
    return this.renderRoot.querySelector(".inset-dialog");
  }
  choiceDialog() {
    return this.renderRoot.querySelector(".choice-dialog");
  }
  lock() {
    this.dispatchEvent(
      new CustomEvent("scrape-lock", {
        detail: this.writePending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  reset() {
    this.generation++, this.mainDialog()?.close(), this.choiceDialog()?.close(), this.options = this.review = void 0, this.candidatePage = void 0, this.query = this.year = this.matchProvider = this.imageChoice = "", this.sourceExpected = {}, this.artworkExpected = { poster: !0, backdrop: !0 }, this.fieldSources = {}, this.initialSources = {}, this.mappingTouched = !1, this.providerDrafts = {}, this.imageDraft = {}, this.resetDraft.clear(), this.imageKind = void 0, this.imagePage = 0, this.pending = void 0, this.busy = !1, this.error = "", this.hints.clear(), this.view = "sources", this.queue.cache.dispose(), this.queue = new T(), this.lock();
  }
  close() {
    if (!(this.pending || this.busy)) {
      if (this.candidatePage && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.candidatePage.search_id).catch(() => {
      }), this.review && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.review.plan_id).catch(() => {
      }), this.client && this.scope)
        for (const e of Object.values(this.providerDrafts))
          this.client.cancelTitleScrape(this.scope, e.plan_id).catch(() => {
          });
      this.reset(), this.requestUpdate();
    }
  }
  closeChoice(e = !1, t = !1) {
    !e && this.busy || (this.candidatePage && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.candidatePage.search_id).catch(() => {
    }), this.review && !t && !Object.keys(this.imageDraft).length && !Object.values(this.providerDrafts).some(
      (i) => i.plan_id === this.review?.plan_id
    ) && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.review.plan_id).catch(() => {
    }), !t && !Object.keys(this.imageDraft).length && (this.review = void 0), this.choiceDialog()?.close(), this.candidatePage = void 0, this.imageKind = void 0, this.imageChoice = "", this.requestUpdate());
  }
  async loadOptions(e = !1) {
    if (!this.client || !this.scope) return;
    const t = await this.client.titleScrapeOptions(
      this.scope,
      this.versionId
    );
    this.options = t, (e || !this.mappingTouched) && (this.fieldSources = Object.fromEntries(
      (t.field_mapping ?? []).map((i) => [
        i.field,
        i.selected
      ])
    ), this.initialSources = { ...this.fieldSources }), e && (this.query = t.search_title ?? t.title ?? "", this.year = t.current?.year ? String(t.current.year) : "", this.sourceExpected = Object.fromEntries(
      t.providers.map((i) => [i.id, !i.unavailable])
    ), this.artworkExpected = {
      poster: !t.artwork_unavailable?.includes("poster"),
      backdrop: !t.artwork_unavailable?.includes("backdrop")
    }, this.mappingTouched = !1);
  }
  async open() {
    if (!this.client || !this.scope?.permissions.edit || this.blocked) return;
    this.reset(), this.busy = !0, this.requestUpdate(), await this.updateComplete, this.mainDialog()?.showModal();
    const e = this.generation;
    try {
      await this.loadOptions(!0);
    } catch (t) {
      e === this.generation && this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  report(e) {
    this.error = y(e), g(e) === "unauthorized" && this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    );
  }
  changedExpectations() {
    return !!this.options && (this.options.providers.some(
      (e) => this.sourceExpected[e.id] !== !e.unavailable
    ) || ["poster", "backdrop"].some(
      (e) => this.artworkExpected[e] !== !this.options.artwork_unavailable?.includes(e)
    ));
  }
  validYear() {
    return !this.year.trim() || Number.isInteger(Number(this.year)) && Number(this.year) >= 1800 && Number(this.year) <= 2100;
  }
  emitChange() {
    this.dispatchEvent(
      new CustomEvent("metadata-changed", { bubbles: !0, composed: !0 })
    );
  }
  async refresh(e) {
    if (!this.client || !this.scope || !this.options || !this.sourceExpected[e] || this.busy || this.writePending || !this.query.trim() || !this.validYear())
      return;
    this.busy = !0, this.error = "", this.hints.delete(e), this.requestUpdate();
    const t = this.generation;
    try {
      const i = await this.client.titleScrapeRefresh(
        this.scope,
        this.versionId,
        e,
        this.query,
        this.year.trim() ? Number(this.year) : void 0,
        !0
      );
      if (t !== this.generation) return;
      i.outcome === "matches" ? (this.candidatePage = i, this.matchMode = "refresh", this.matchProvider = e, this.requestUpdate(), await this.updateComplete, this.choiceDialog()?.showModal()) : i.outcome === "staged" && (this.providerDrafts = { ...this.providerDrafts, [e]: i }, i.has_data || this.hints.add(e));
    } catch (i) {
      t === this.generation && this.report(i);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate(), this.options?.auto_save && this.hasDraft && !this.candidatePage && this.save());
    }
  }
  async useMatch(e) {
    if (!this.client || !this.scope || !this.candidatePage || this.busy) return;
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      if (this.matchMode === "refresh") {
        const i = await this.client.titleScrapeRefreshChoice(
          this.scope,
          this.versionId,
          this.matchProvider,
          this.candidatePage.search_id,
          e,
          !0
        );
        if (t !== this.generation) return;
        if (i.outcome !== "staged") throw new v("refresh_required");
        this.providerDrafts = {
          ...this.providerDrafts,
          [this.matchProvider]: i
        }, i.has_data || this.hints.add(this.matchProvider), this.closeChoice(!0);
      } else {
        const i = await this.client.titleScrapePreview(
          this.scope,
          this.versionId,
          "tmdb",
          this.candidatePage.search_id,
          e
        );
        if (t !== this.generation) return;
        if ("search_id" in i) throw new v("refresh_required");
        this.review = i, this.candidatePage = void 0, this.imageChoice = "", this.requestUpdate();
      }
    } catch (i) {
      t === this.generation && this.report(i);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate(), this.options?.auto_save && this.hasDraft && !this.candidatePage && !this.imageKind && this.save());
    }
  }
  async editImage(e) {
    if (!this.client || !this.scope || this.busy || this.writePending) return;
    this.busy = !0, this.error = "", this.imageKind = e, this.requestUpdate();
    const t = this.generation;
    try {
      const i = this.providerDrafts.tmdb, s = this.review ?? (i?.has_data ? {
        plan_id: i.plan_id,
        title: this.options?.title ?? "",
        matched: i.matched ?? void 0,
        fields: {},
        images: i.images,
        artwork_enabled: !!this.options?.artwork_enabled
      } : await this.client.titleScrapePreview(
        this.scope,
        this.versionId,
        "tmdb"
      ));
      if (t !== this.generation) return;
      this.imageChoice = "", this.imagePage = 0, "search_id" in s ? (this.candidatePage = s, this.matchMode = "image", this.matchProvider = "tmdb") : this.review = s, this.requestUpdate(), await this.updateComplete, this.choiceDialog()?.showModal();
    } catch (i) {
      t === this.generation && (this.imageKind = void 0, this.report(i));
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async useImage() {
    !this.review || !this.imageKind || !this.imageChoice || this.busy || (this.imageDraft = {
      ...this.imageDraft,
      [this.imageKind]: this.imageChoice
    }, this.resetDraft.delete(this.imageKind), this.closeChoice(!0, !0), this.options?.auto_save && await this.save());
  }
  async resetArtwork(e) {
    this.busy || this.writePending || (e === "backdrop" && this.imageDraft.backdrop ? (delete this.imageDraft.backdrop, this.resetDraft.delete(e)) : (delete this.imageDraft[e], this.resetDraft.add(e)), this.requestUpdate(), this.options?.auto_save && this.hasDraft && await this.save());
  }
  async save() {
    if (!this.client || !this.scope || !this.options?.snapshot || this.busy || !this.hasDraft && !this.pending)
      return;
    this.busy = !0, this.error = "", this.requestUpdate();
    const e = this.generation;
    try {
      const t = this.mappingTouched ? Object.fromEntries(
        (this.options.field_mapping ?? []).filter(
          (i) => i.override || this.fieldSources[i.field] !== this.initialSources[i.field]
        ).map((i) => [i.field, this.fieldSources[i.field]])
      ) : null;
      if (this.pending ??= this.client.prepareMetadataDraft(this.scope, {
        title_id: this.versionId,
        snapshot: this.options.snapshot,
        providers: Object.fromEntries(
          Object.entries(this.providerDrafts).map(([i, s]) => [
            i,
            s.plan_id
          ])
        ),
        sources: t,
        expectations: this.changedExpectations() ? { providers: this.sourceExpected, artwork: this.artworkExpected } : null,
        image_plan: Object.keys(this.imageDraft).length ? this.review?.plan_id ?? "" : "",
        images: this.imageDraft,
        resets: [...this.resetDraft]
      }), this.lock(), await this.client.applyMetadataDraft(this.pending), e !== this.generation) return;
      this.pending = void 0, this.lock(), this.emitChange(), this.options.auto_save ? (this.providerDrafts = {}, this.imageDraft = {}, this.resetDraft.clear(), this.review = void 0, await this.loadOptions(!0)) : this.reset();
    } catch (t) {
      e === this.generation && (this.report(t), [
        "invalid_request",
        "refresh_required",
        "metadata_disabled",
        "not_found",
        "library_artwork"
      ].includes(g(t)) && (this.pending = void 0, this.lock()));
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  status(e, t) {
    return a`<p class="status-line" data-complete=${t}>
      <span aria-hidden="true">${t ? "✓" : "⚠"}</span>${e}:
      ${t ? "Complete" : "Missing"}
    </p>`;
  }
  switchFor(e, t, i) {
    return a`<label class="switch" title=${e}
      ><input
        type="checkbox"
        aria-label=${e}
        .checked=${t}
        ?disabled=${this.busy || this.writePending || !this.options?.snapshot}
        @change=${(s) => {
      i(s.target.checked), this.requestUpdate(), this.options?.auto_save && this.save();
    }} /><span aria-hidden="true"></span
    ></label>`;
  }
  currentMovie() {
    const e = this.options?.current;
    if (!e) return l;
    const t = !!this.imageDraft.poster || (this.resetDraft.has("poster") ? !!e.original_artwork_key : this.options?.artwork_present?.poster ?? !!e.artwork_key), i = !!this.imageDraft.backdrop || (this.resetDraft.has("backdrop") ? !!e.previous_backdrop_key : this.options?.artwork_present?.backdrop ?? !!e.backdrop_key), s = this.options?.providers.every(
      (o) => !this.sourceExpected[o.id] || o.has_data || !!this.providerDrafts[o.id]?.has_data
    ) ?? !0, r = this.options?.providers.some(
      (o) => o.id === "tmdb" && o.available
    );
    return a`<section
      class="manager-section"
      aria-label="Current Library movie"
    >
      <h3>Current Library Info <small class="muted">Existing record</small></h3>
      <div class="current-layout">
        <div class="current-identity">
          <div class="current-poster">
            ${this.imageDraft.poster && this.review ? a`<kaleidescape-scrape-image
                    .client=${this.client}
                    .scope=${this.scope}
                    .queue=${this.queue}
                    .plan=${this.review.plan_id}
                    .choice=${this.imageDraft.poster}
                  ></kaleidescape-scrape-image>` : a`<kaleidescape-library-cover
                    .client=${this.client}
                    .scope=${this.scope}
                    .queue=${this.queue}
                    .artworkKey=${this.resetDraft.has("poster") ? e.original_artwork_key : e.artwork_key}
                    .title=${e.title}
                  ></kaleidescape-library-cover>`}
            <div class="image-links">
              ${r && this.options?.artwork_enabled ? a`<button class="text-link" ?disabled=${this.busy || this.writePending} @click=${() => {
      this.editImage("poster");
    }}>Edit</button>` : l}
              ${e.original_artwork_key ? a`<button class="text-link" ?disabled=${this.busy || this.writePending} @click=${() => {
      this.resetArtwork("poster");
    }}>Reset</button>` : l}
            </div>
          </div>
          <div>
            <h2 class="movie-title">${e.title}</h2>
            <p class="movie-details">
              ${e.year ?? "Year unavailable"} ·
              ${e.duration_seconds ? `${Math.round(e.duration_seconds / 60)} min` : "Runtime unavailable"}
            </p>
            <dl class="current-meta">
              <dt>Director</dt>
              <dd>${e.directors.join(", ") || "Unavailable"}</dd>
              <dt>Cast</dt>
              <dd>${e.actors.join(", ") || "Unavailable"}</dd>
              <dt>Metadata updated</dt>
              <dd>
                ${e.metadata_synced_at ? new Date(e.metadata_synced_at).toLocaleDateString() : "Unavailable"}
              </dd>
            </dl>
          </div>
        </div>
        <div class="current-backdrop">
          ${this.imageDraft.backdrop && this.review ? a`<kaleidescape-scrape-image
                  .client=${this.client}
                  .scope=${this.scope}
                  .queue=${this.queue}
                  .plan=${this.review.plan_id}
                  .choice=${this.imageDraft.backdrop}
                ></kaleidescape-scrape-image>` : a`<kaleidescape-library-cover
                  .client=${this.client}
                  .scope=${this.scope}
                  .queue=${this.queue}
                  .artworkKey=${this.resetDraft.has("backdrop") ? e.previous_backdrop_key : e.backdrop_key}
                  .title=${`${e.title} backdrop`}
                  .fit=${"contain"}
                ></kaleidescape-library-cover>`}
          ${r && this.options?.artwork_enabled ? a`<div class="image-links"><button class="text-link" ?disabled=${this.busy || this.writePending} @click=${() => {
      this.editImage("backdrop");
    }}>Edit</button>${e.backdrop_key || e.backdrop_reset_available || this.imageDraft.backdrop ? a`<button class="text-link" ?disabled=${this.busy || this.writePending} @click=${() => {
      this.resetArtwork("backdrop");
    }}>Reset</button>` : l}</div>` : l}
        </div>
        <div class="artwork-status">
          <h3>Scraping status</h3>
          ${this.status("Artwork", !this.artworkExpected.poster || t)}
          ${this.status("Backdrop", !this.artworkExpected.backdrop || i)}
          ${this.status("Metadata", s)}
        </div>
        <div
          class="artwork-flags"
          aria-label="Artwork availability declarations"
        >
          <label class="check">
            <input
              type="checkbox"
              aria-label="Cover art unavailable"
              .checked=${!this.artworkExpected.poster}
              ?disabled=${this.busy || this.writePending || !this.options?.snapshot}
              @change=${(o) => {
      this.artworkExpected.poster = !o.target.checked, this.requestUpdate(), this.options?.auto_save && this.save();
    }}
            />
            Cover art unavailable
          </label>
          <label class="check">
            <input
              type="checkbox"
              aria-label="Backdrop art unavailable"
              .checked=${!this.artworkExpected.backdrop}
              ?disabled=${this.busy || this.writePending || !this.options?.snapshot}
              @change=${(o) => {
      this.artworkExpected.backdrop = !o.target.checked, this.requestUpdate(), this.options?.auto_save && this.save();
    }}
            />
            Backdrop art unavailable
          </label>
        </div>
      </div>
    </section>`;
  }
  sourcesPanel() {
    return this.options ? a`<section class="manager-section" aria-label="Scraper sources">
      <h3>Scraper Sources</h3>
      <p class="muted">
        Refresh searches this source using the title and year above. A unique
        match is downloaded automatically.
        ${this.options.auto_save ? "Changes are saved immediately." : "Changes remain in draft until you select Save."}
      </p>
      <div class="source-list">
        ${this.options.providers.map(
      (e) => a`<div class="source-row" data-provider=${e.id}>
              ${this.switchFor(
        `Use ${e.label} for this movie`,
        this.sourceExpected[e.id] ?? !1,
        (t) => {
          this.sourceExpected = {
            ...this.sourceExpected,
            [e.id]: t
          };
        }
      )}
              <div class="source-name">
                <strong>${e.label}</strong>
                ${Vi(e.match_url) ? a`<a href=${Vi(e.match_url)} target="_blank" rel="noopener noreferrer" aria-label=${`View ${e.label} match`}>View match</a>` : l}
              </div>
              <span class="source-detail">
                ${this.providerDrafts[e.id] ? this.providerDrafts[e.id].has_data ? "Downloaded - Ready to save" : "No data available - Ready to save" : e.has_data ? e.fetched_at ? `Downloaded - Updated ${new Date(e.fetched_at).toLocaleDateString()}` : "Downloaded - Update date unavailable" : e.checked_at ? `No data available - Last Checked ${new Date(e.checked_at).toLocaleDateString()}` : "Not yet scanned"}
                <br /><small
                  >${this.providerDrafts[e.id]?.has_data ? `${Object.keys(this.providerDrafts[e.id].values).length} fields ready · ` : e.has_data ? `${e.fields ?? 0} fields saved · ` : ""}${this.sourceExpected[e.id] ? e.available ? "Included" : "Needs configuration" : "Excluded from completeness"}</small
                >
              </span>
              <div class="source-actions">
                ${this.hints.has(e.id) ? a`<span class="source-hint" role="status">⚠ Try again with no year</span>` : l}
                <button
                  ?disabled=${!e.available || !this.sourceExpected[e.id] || this.busy || this.writePending || !this.query.trim() || !this.validYear()}
                  @click=${() => {
        this.refresh(e.id);
      }}
                >
                  Refresh
                </button>
              </div>
            </div>`
    )}
      </div>
    </section>` : l;
  }
  formatted(e) {
    return e == null || e === "" || Array.isArray(e) && !e.length ? "—" : Array.isArray(e) ? e.join(", ") : String(e);
  }
  fieldLabel(e) {
    return this.options?.field_mapping?.find((t) => t.field === e)?.label ?? e.replaceAll("_", " ").replace(/^./, (t) => t.toUpperCase());
  }
  tabKey(e) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const t = [
      ...e.currentTarget.querySelectorAll('[role="tab"]')
    ], i = t.findIndex(
      (r) => r.getAttribute("aria-selected") === "true"
    ), s = e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + t.length) % t.length;
    e.preventDefault(), t[s]?.click(), t[s]?.focus();
  }
  mappingPanel() {
    return this.options ? a`<section class="manager-section" aria-label="Field mapping">
      <h3>Field Mapping</h3>
      <p class="muted">
        Select the source whose value should appear in the Library for each
        field. Raw Library values come from the server scan. Automatic settings
        may combine credits until a source is saved for that field.
      </p>
      <div class="mapping-scroll">
        <table class="mapping-table">
          <colgroup>
            <col class="field-column" />
            <col class="source-column" />
            ${this.options.providers.map(() => a`<col class="source-column" />`)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Raw Library</th>
              ${this.options.providers.map((e) => a`<th scope="col">${e.label}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${(this.options.field_mapping ?? []).map(
      (e) => a`<tr>
                  <th scope="row">${e.label}</th>
                  ${[
        "original",
        ...this.options.providers.map((t) => t.id)
      ].map((t) => {
        const i = this.providerDrafts[t]?.has_data ? this.providerDrafts[t].values[e.field] : e.values[t], s = i != null && i !== "" && (!Array.isArray(i) || i.length > 0);
        return a`<td>
                      <label
                        ><input
                          type="radio"
                          name=${`field-${e.field}`}
                          aria-label=${`Use ${t === "original" ? "Raw Library" : this.options.providers.find((r) => r.id === t)?.label} for ${e.label}`}
                          .checked=${this.fieldSources[e.field] === t}
                          ?disabled=${this.busy || this.writePending || !s}
                          @change=${() => {
          this.fieldSources = {
            ...this.fieldSources,
            [e.field]: t
          }, this.mappingTouched = !0, this.requestUpdate(), this.options?.auto_save && this.save();
        }}
                        />
                        <span class="mapping-value"
                          >${this.formatted(i)}</span
                        ></label
                      >
                    </td>`;
      })}
                </tr>`
    )}
          </tbody>
        </table>
      </div>
    </section>` : l;
  }
  historyPanel() {
    return this.options ? a`<section class="manager-section" aria-label="Source history">
      <h3>Source History</h3>
      ${this.options.history?.length ? a`<div class="history-list">
              ${this.options.history.map((e) => {
      const t = this.options.providers.find(
        (s) => s.id === e.provider
      ), i = Object.entries(e.values);
      return a`<article class="history-entry">
                  <div class="history-head">
                    <strong>${t?.label ?? e.provider}</strong>
                    <time datetime=${e.checked_at}
                      >${new Date(e.checked_at).toLocaleString()}</time
                    >
                    <span class="history-outcome"
                      >${e.outcome === "downloaded" ? `${i.length} values saved` : "No data available"}</span
                    >
                  </div>
                  ${i.length ? a`<div class="history-values">
                          ${i.map(([s, r]) => a`<div class="history-value"><strong>${this.fieldLabel(s)}</strong><span>${this.formatted(r)}</span></div>`)}
                        </div>` : a`<p class="muted">
                          No provider values were returned for this check.
                        </p>`}
                </article>`;
    })}
            </div>` : a`<p class="muted">No provider history is available yet.</p>`}
    </section>` : l;
  }
  searchPanel() {
    return this.options ? a`<section class="manager-section" aria-label="Search and match">
      <h3>Search &amp; Match</h3>
      <div class="match-search">
        <label
          >Title search<input
            type="search"
            maxlength="200"
            .value=${this.query}
            ?disabled=${this.busy || this.writePending}
            @input=${(e) => {
      this.query = e.target.value, this.requestUpdate();
    }}
        /></label>
        <label class="year-field"
          >Release year<input
            type="number"
            min="1800"
            max="2100"
            step="1"
            .value=${this.year}
            ?disabled=${this.busy || this.writePending}
            @input=${(e) => {
      this.year = e.target.value, this.requestUpdate();
    }}
        /></label>
      </div>
    </section>` : l;
  }
  choiceContent() {
    if (this.candidatePage)
      return a`<div>
        <div class="card-head">
          <h2 id="choice-title">Choose a movie match</h2>
          ${S(() => this.closeChoice(), this.busy)}
        </div>
        <p>
          Current Library movie:
          <strong>${this.options?.current?.title}</strong>
          (${this.options?.current?.year ?? "year unavailable"})
        </p>
        <p class="muted">
          Select the matching result to download its metadata.
        </p>
        ${this.candidatePage.candidates.length ? l : a`<p>No matching movies were found. Try Refresh with another title or year.</p>`}
        <div class="match-list">
          ${this.candidatePage.candidates.map(
        (i) => a`<article class="match-card">
                ${i.has_artwork ? a`<kaleidescape-scrape-image .client=${this.client} .scope=${this.scope} .queue=${this.queue} .plan=${this.candidatePage.search_id} .choice=${i.id}></kaleidescape-scrape-image>` : a`<div class="muted">No cover</div>`}
                <div>
                  <h3>${i.title} (${i.year})</h3>
                  <p>
                    Director: ${i.directors.join(", ") || "Unavailable"}
                  </p>
                  <p>Cast: ${i.actors.join(", ") || "Unavailable"}</p>
                  <button
                    ?disabled=${this.busy}
                    @click=${() => {
          this.useMatch(i.id);
        }}
                  >
                    Use this match
                  </button>
                </div>
              </article>`
      )}
        </div>
      </div>`;
    if (!this.review || !this.imageKind) return l;
    const e = this.review.images.filter(
      (i) => i.kind === this.imageKind
    ), t = this.imagePage * 6;
    return a`<div>
      <div class="card-head">
        <h2 id="choice-title">
          Choose ${this.imageKind === "poster" ? "cover art" : "backdrop art"}
        </h2>
        ${S(() => this.closeChoice(), this.busy)}
      </div>
      <p class="muted">
        Images from TMDB for
        ${this.review.matched?.title ?? this.options?.title}.
      </p>
      ${e.length ? l : a`<p>No images available from TMDB.</p>`}
      <div class="image-grid" data-kind=${this.imageKind}>
        ${e.slice(t, t + 6).map(
      (i, s) => a`<label>
              <kaleidescape-scrape-image
                .client=${this.client}
                .scope=${this.scope}
                .queue=${this.queue}
                .plan=${this.review.plan_id}
                .choice=${i.id}
              ></kaleidescape-scrape-image>
              <input
                type="radio"
                name="artwork-choice"
                .checked=${this.imageChoice === i.id}
                ?disabled=${this.busy}
                @change=${() => {
        this.imageChoice = i.id, this.requestUpdate();
      }}
              />
              ${this.imageKind === "poster" ? "Cover" : "Backdrop"}
              ${t + s + 1}
              <small>${i.width ?? "?"} × ${i.height ?? "?"}</small>
            </label>`
    )}
      </div>
      ${e.length > 6 ? a`<div class="actions">
              <button
                ?disabled=${!t}
                @click=${() => {
      this.imagePage--, this.requestUpdate();
    }}
              >
                Previous
              </button>
              <button
                ?disabled=${t + 6 >= e.length}
                @click=${() => {
      this.imagePage++, this.requestUpdate();
    }}
              >
                Next
              </button>
            </div>` : l}
      <div class="dialog-footer manager-actions">
        <button
          class="primary"
          ?disabled=${!this.imageChoice || this.busy}
          @click=${() => {
      this.useImage();
    }}
        >
          Use image
        </button>
      </div>
    </div>`;
  }
  render() {
    return this.scope?.permissions.edit ? a`${ze("Scrape title", "scrape", this.blocked || this.writePending, () => {
      this.open();
    }, "scrape-button")}
      <dialog
        data-admin-dialog
        class="inset-dialog"
        aria-labelledby="scrape-title"
        @click=${q}
        @cancel=${(e) => {
      e.preventDefault(), this.close();
    }}
      >
        <div class="card-head manager-head">
          <div>
            <h2 id="scrape-title">Movie Metadata Manager</h2>
            <p>Search, scrape and reconcile metadata.</p>
          </div>
          ${S(() => this.close(), this.busy || this.writePending)}
        </div>
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.busy ? a`<p role="status">Updating movie metadata…</p>` : l}
        ${this.currentMovie()}${this.searchPanel()}
        ${this.options ? a`<div
                class="page-tabs manager-tabs"
                role="tablist"
                aria-label="Metadata manager sections"
                @keydown=${this.tabKey}
              >
                ${["sources", "mapping", "history"].map(
      (e) => a`<button
                      role="tab"
                      aria-selected=${this.view === e}
                      tabindex=${this.view === e ? 0 : -1}
                      @click=${() => {
        this.view = e, this.requestUpdate();
      }}
                    >
                      ${e === "sources" ? "Sources" : e === "mapping" ? "Field Mapping" : "History"}
                    </button>`
    )}
              </div>` : l}
        ${this.view === "sources" ? this.sourcesPanel() : this.view === "mapping" ? this.mappingPanel() : this.historyPanel()}
        ${this.options && (!this.options.auto_save || this.pending) ? a`<div class="dialog-footer manager-actions">
                ${this.pending ? a`<button
                        @click=${() => {
      window.confirm(
        "Inspect the Library before discarding an unconfirmed save. Discard retry?"
      ) && (this.pending = void 0, this.lock(), this.requestUpdate());
    }}
                      >
                        Discard retry
                      </button>` : l}
                ${!this.options?.auto_save || this.pending ? a`<button
                        class="primary"
                        ?disabled=${this.busy || !this.pending && !this.hasDraft}
                        @click=${() => {
      this.save();
    }}
                      >
                        ${this.pending ? "Retry exact save" : "Save"}
                      </button>` : l}
              </div>` : l}
      </dialog>
      <dialog
        data-admin-dialog
        class="choice-dialog"
        aria-labelledby="choice-title"
        @click=${q}
        @cancel=${(e) => {
      e.preventDefault(), this.busy || this.closeChoice();
    }}
      >
        ${this.choiceContent()}
      </dialog>` : l;
  }
};
Ve.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  versionId: {},
  blocked: { type: Boolean }
}, Ve.styles = [
  E,
  xi,
  C`
      :host {
        display: inline-block;
      }
      .scrape-button {
        border-radius: 999px;
        min-height: 44px;
      }
      dialog.inset-dialog {
        width: min(1180px, calc(100% - 24px));
        max-height: min(
          912px,
          calc(var(--companion-viewport-height, 100dvh) - 32px)
        );
        overflow-y: auto;
      }
      dialog.inset-dialog:modal,
      dialog.choice-dialog:modal {
        inset-block-start: calc(
          var(--companion-viewport-top, 0px) +
            var(--companion-viewport-height, 100dvh) * 0.5
        );
        transform: translateY(-50%);
      }
      dialog.choice-dialog {
        width: min(650px, calc(100% - 24px));
        max-height: min(700px, calc(100dvh - 32px));
        overflow-y: auto;
      }
      .manager-head > div:first-child {
        flex: 1;
        min-width: 0;
      }
      .manager-head .dialog-close {
        margin-left: auto;
      }
      .manager-head p {
        margin: 2px 0 0;
        color: var(--muted);
      }
      .manager-section {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 14px;
        margin-block: 12px;
        background: var(--card-background-color, transparent);
      }
      .manager-section h3 {
        margin: 0 0 10px;
      }
      .current-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(200px, 0.85fr) minmax(
            145px,
            0.7fr
          );
        gap: 14px;
        align-items: stretch;
      }
      .current-identity {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr);
        gap: 12px;
        min-width: 0;
      }
      .current-identity kaleidescape-library-cover {
        width: 84px;
        height: 126px;
        aspect-ratio: 2/3;
        border-radius: 8px;
      }
      .current-identity kaleidescape-scrape-image {
        width: 84px;
        height: 126px;
        aspect-ratio: 2/3;
        border-radius: 8px;
      }
      .current-backdrop {
        position: relative;
        padding-inline: 14px;
        min-width: 0;
      }
      .current-backdrop::before,
      .current-backdrop::after {
        content: "";
        position: absolute;
        top: 0;
        height: 100%;
        width: 1px;
        background: var(--line);
      }
      .current-backdrop::before {
        left: 0;
      }
      .current-backdrop::after {
        right: 0;
      }
      .current-backdrop kaleidescape-library-cover {
        width: 100%;
        max-width: 224px;
        height: 126px;
        aspect-ratio: 16/9;
        border-radius: 8px;
      }
      .current-backdrop kaleidescape-scrape-image {
        width: 100%;
        max-width: 224px;
        height: 126px;
        aspect-ratio: 16/9;
        border-radius: 8px;
      }
      .movie-title {
        font-size: 20px;
        line-height: 1.2;
        margin: 0 0 4px;
        overflow-wrap: anywhere;
      }
      .movie-details {
        margin: 0 0 4px;
      }
      .current-meta {
        margin: 4px 0 0;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 10px;
        font-size: 12px;
      }
      .current-meta dt {
        color: var(--muted);
      }
      .current-meta dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .image-links,
      .status-line {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-top: 4px;
        font-size: 11px;
      }
      .image-links {
        flex-wrap: wrap;
      }
      .image-links button {
        min-height: unset;
        padding: 0;
        font-size: 11px;
      }
      .text-link {
        background: none;
        border: 0;
        color: var(--accent);
        text-decoration: underline;
        cursor: pointer;
      }
      .artwork-flags {
        grid-column: 1 / 3;
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(200px, 0.85fr);
        gap: 14px;
        align-items: center;
      }
      .artwork-flags .check {
        margin: 0;
        font-size: 11px;
        gap: 6px;
      }
      .artwork-flags .check input {
        width: 16px;
        height: 16px;
        min-height: 16px;
      }
      .status-line[data-complete="true"] span {
        color: var(--success-color, #4caf50);
      }
      .status-line[data-complete="false"] span {
        color: var(--warning-color, #e2a600);
      }
      .switch {
        position: relative;
        display: inline-flex;
        width: 38px;
        height: 22px;
        flex: none;
        cursor: pointer;
      }
      .switch input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
      }
      .switch span {
        width: 38px;
        height: 22px;
        border-radius: 999px;
        background: var(--divider-color, #666);
      }
      .switch span::after {
        content: "";
        display: block;
        width: 18px;
        height: 18px;
        margin: 2px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.15s;
      }
      .switch input:checked + span {
        background: var(--accent);
      }
      .switch input:checked + span::after {
        transform: translateX(16px);
      }
      .switch input:focus-visible + span {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }
      .switch input:disabled + span {
        opacity: 0.5;
      }
      .source-list {
        display: grid;
        gap: 8px;
      }
      .source-row {
        display: grid;
        grid-template-columns:
          38px minmax(120px, 1fr) minmax(160px, 1.4fr)
          auto;
        gap: 10px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
      }
      .source-row small,
      .muted {
        color: var(--muted);
      }
      .source-name {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px 10px;
      }
      .source-name a {
        color: var(--accent);
        font-size: 12px;
      }
      .source-row button {
        min-height: 36px;
      }
      .source-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .source-hint {
        color: var(--warning-color, #e6a700);
        font-size: 12px;
      }
      .match-search {
        display: flex;
        align-items: end;
        gap: 8px;
      }
      .match-search label:first-child {
        flex: 1;
        min-width: 0;
      }
      .match-search .year-field {
        width: 110px;
      }
      .manager-tabs {
        margin-top: 12px;
      }
      .manager-actions {
        justify-content: flex-end;
      }
      .mapping-scroll {
        overflow-x: auto;
      }
      .mapping-table {
        border-collapse: collapse;
        width: max-content;
        min-width: 100%;
        table-layout: fixed;
        font-size: 12px;
      }
      .mapping-table .field-column {
        width: 155px;
      }
      .mapping-table .source-column {
        width: 220px;
      }
      .mapping-table th,
      .mapping-table td {
        border: 1px solid var(--line);
        padding: 8px;
        text-align: left;
        vertical-align: top;
        min-width: 115px;
      }
      .mapping-table th:first-child {
        min-width: 125px;
      }
      .mapping-table thead th {
        background: var(--card-background-color, transparent);
      }
      .mapping-table label {
        display: flex;
        align-items: start;
        gap: 5px;
        cursor: pointer;
      }
      .mapping-table input {
        flex: none;
      }
      .mapping-table input[type="radio"],
      .image-grid input[type="radio"] {
        appearance: none;
        width: 14px;
        height: 14px;
        min-width: 14px;
        min-height: 14px;
        margin: 2px 0;
        padding: 0;
        border: 1px solid var(--secondary-text-color, #888);
        border-radius: 50%;
        background: transparent;
      }
      .mapping-table input[type="radio"]:checked,
      .image-grid input[type="radio"]:checked {
        border: 4px solid var(--accent);
      }
      .mapping-table input[type="radio"]:focus-visible,
      .image-grid input[type="radio"]:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .mapping-value {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        max-height: 100px;
        overflow-y: auto;
        display: block;
      }
      .history-list {
        display: grid;
        gap: 12px;
      }
      .history-entry {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
      }
      .history-head {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(180px, 1fr) auto;
        align-items: baseline;
        gap: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
      }
      .history-head time,
      .history-outcome {
        color: var(--muted);
        font-size: 12px;
      }
      .history-values {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 18px;
        padding-top: 10px;
      }
      .history-value {
        display: grid;
        grid-template-columns: minmax(95px, 0.4fr) minmax(0, 1fr);
        gap: 8px;
        min-width: 0;
        font-size: 12px;
      }
      .history-value > :last-child {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .match-list,
      .image-grid {
        display: grid;
        gap: 10px;
      }
      .match-card {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        gap: 12px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .match-card h3 {
        margin: 0 0 5px;
        font-size: 16px;
      }
      .match-card p {
        margin: 4px 0;
        font-size: 12px;
      }
      .match-card kaleidescape-scrape-image {
        width: 64px;
        height: 96px;
      }
      .image-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .image-grid label {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 6px;
      }
      .image-grid label:has(input:checked) {
        border-color: var(--accent);
      }
      .image-grid kaleidescape-scrape-image {
        display: block;
        width: 100%;
        aspect-ratio: 2/3;
      }
      .image-grid[data-kind="backdrop"] kaleidescape-scrape-image {
        aspect-ratio: 16/9;
      }
      .image-grid small {
        font-size: 11px;
      }
      .image-grid input[type="radio"] {
        vertical-align: middle;
        margin: 6px 5px 2px 0;
      }
      @media (max-width: 750px) {
        dialog.inset-dialog {
          width: min(980px, calc(100% - 24px));
        }
        .current-layout {
          grid-template-columns: minmax(0, 1fr) minmax(180px, 0.8fr);
        }
        .artwork-status {
          grid-column: 1 / -1;
        }
        .source-row {
          grid-template-columns: 38px minmax(0, 1fr) auto;
        }
        .source-detail {
          grid-column: 2 / -1;
        }
      }
      @media (max-width: 540px) {
        .current-layout {
          grid-template-columns: 1fr;
        }
        .current-backdrop {
          padding: 0;
        }
        .current-backdrop::before,
        .current-backdrop::after {
          display: none;
        }
        .artwork-flags {
          grid-column: 1;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .history-head,
        .history-values {
          grid-template-columns: 1fr;
        }
        .source-row {
          grid-template-columns: 38px minmax(0, 1fr);
        }
        .source-actions {
          grid-column: 2;
          justify-self: start;
        }
        .match-search {
          flex-wrap: wrap;
        }
        .image-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `
];
let Dt = Ve;
customElements.get("kaleidescape-title-scrape") || customElements.define("kaleidescape-title-scrape", Dt);
function Qi(n) {
  return n.toLocaleLowerCase().normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").match(/[\p{L}\p{N}_]+/gu)?.join(" ") ?? "";
}
function ba(n, e) {
  const t = Math.min(2, Math.max(1, Math.ceil(n.length / 4)));
  if (n.length < 3 || Math.max(n.length, e.length) > 100 || Math.abs(n.length - e.length) > t)
    return !1;
  let i = Array.from({ length: e.length + 1 }, (r, o) => o), s = i;
  for (let r = 1; r <= n.length; r++) {
    const o = Array(e.length + 1).fill(t + 1);
    o[0] = r;
    for (let d = Math.max(1, r - t); d <= Math.min(e.length, r + t); d++) {
      let c = Math.min(
        i[d] + 1,
        o[d - 1] + 1,
        i[d - 1] + +(n[r - 1] !== e[d - 1])
      );
      r > 1 && d > 1 && n[r - 1] === e[d - 2] && n[r - 2] === e[d - 1] && (c = Math.min(c, s[d - 2] + 1)), o[d] = c;
    }
    if (Math.min(...o) > t) return !1;
    s = i, i = o;
  }
  return i[e.length] <= t;
}
function xs(n, e, t = !1) {
  const i = e.trim();
  if (i.length >= 2 && i.startsWith('"') && i.endsWith('"')) {
    let c;
    try {
      c = JSON.parse(i).trim();
    } catch {
      c = i.slice(1, -1).trim();
    }
    if (!c) return !1;
    const h = c.toLocaleLowerCase().split(/\s+/).map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(
      "(?<![\\p{L}\\p{N}_])" + h.join("\\s+") + "(?![\\p{L}\\p{N}_])",
      "u"
    ).test(n.toLocaleLowerCase());
  }
  if (n.toLocaleLowerCase().includes(e.toLocaleLowerCase()))
    return !0;
  if (!t) return !1;
  const s = Qi(e), r = Qi(n);
  if (!s) return !1;
  if (r.includes(s)) return !0;
  const o = s.split(" "), d = r.split(" ");
  return o.length <= 12 && o.every(
    (c) => d.some((h) => h.includes(c) || ba(c, h))
  );
}
const J = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, ks = (n) => (...e) => ({ _$litDirective$: n, values: e });
let $s = class {
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
};
const { I: va } = ta, Ji = (n) => n, ya = (n) => n.strings === void 0, Hi = () => document.createComment(""), oe = (n, e, t) => {
  const i = n._$AA.parentNode, s = e === void 0 ? n._$AB : e._$AA;
  if (t === void 0) {
    const r = i.insertBefore(Hi(), s), o = i.insertBefore(Hi(), s);
    t = new va(r, o, n, n.options);
  } else {
    const r = t._$AB.nextSibling, o = t._$AM, d = o !== n;
    if (d) {
      let c;
      t._$AQ?.(n), t._$AM = n, t._$AP !== void 0 && (c = n._$AU) !== o._$AU && t._$AP(c);
    }
    if (r !== s || d) {
      let c = t._$AA;
      for (; c !== r; ) {
        const h = Ji(c).nextSibling;
        Ji(i).insertBefore(c, s), c = h;
      }
    }
  }
  return t;
}, Q = (n, e, t = n) => (n._$AI(e, t), n), wa = {}, Cs = (n, e = wa) => n._$AH = e, xa = (n) => n._$AH, $t = (n) => {
  n._$AR(), n._$AA.remove();
};
const _i = ks(class extends $s {
  constructor(n) {
    if (super(n), n.type !== J.PROPERTY && n.type !== J.ATTRIBUTE && n.type !== J.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!ya(n)) throw Error("`live` bindings can only contain a single expression");
  }
  render(n) {
    return n;
  }
  update(n, [e]) {
    if (e === z || e === l) return e;
    const t = n.element, i = n.name;
    if (n.type === J.PROPERTY) {
      if (e === t[i]) return z;
    } else if (n.type === J.BOOLEAN_ATTRIBUTE) {
      if (!!e === t.hasAttribute(i)) return z;
    } else if (n.type === J.ATTRIBUTE && t.getAttribute(i) === e + "") return z;
    return Cs(n), e;
  }
}), yt = C`
  .library-notifications {
    position: fixed;
    z-index: 100;
    top: max(
      16px,
      var(--companion-viewport-top, 0px),
      env(safe-area-inset-top, 0px)
    );
    right: max(16px, env(safe-area-inset-right, 0px));
    width: min(380px, calc(100vw - 32px));
    max-height: min(70vh, 600px);
    overflow-y: auto;
    display: grid;
    gap: 8px;
    pointer-events: none;
  }
  .library-notification {
    position: relative;
    margin: 0;
    padding: 12px 48px 12px 14px;
    border: 1px solid var(--line);
    border-inline-start: 4px solid var(--library-notification-edge, #8b949e);
    border-radius: 10px;
    background: var(--surface);
    box-shadow: 0 5px 24px #0004;
    pointer-events: auto;
  }
  .library-notification.notification-success {
    --library-notification-edge: #2e9b57;
  }
  .library-notification.notification-warning {
    --library-notification-edge: #d9a900;
  }
  .library-notification.notification-progress {
    --library-notification-edge: #168bd2;
  }
  .library-notification.notification-error {
    --library-notification-edge: #df4646;
  }
  .library-notification.notification-info {
    --library-notification-edge: #8b949e;
  }
  .library-notification .notification-close {
    position: absolute;
    top: 5px;
    right: 5px;
    padding: 7px;
    min-height: 36px;
    width: 36px;
    height: 36px;
    border: 0;
    background: transparent;
  }
  .notification-close svg {
    width: 18px;
    height: 18px;
  }
  .collection-pending .collection-badge,
  .collection-pending .status-badge,
  .collection-pending .cover-flag {
    opacity: 0.45;
  }
  .collection-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    margin: 4px;
    border: 2px solid var(--line);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: collection-spin 0.8s linear infinite;
  }
  .pending-collection-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    opacity: 0.65;
    font-size: 11px;
  }
  .pending-collection-badge svg {
    width: 14px;
    height: 14px;
  }
  .cover-flags .pending-collection-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    max-width: calc(100% - 12px);
  }
  @keyframes collection-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .collection-spinner {
      animation: none;
      border-color: var(--accent);
    }
  }
  .library-toolbar [hidden],
  .library-toolbar[hidden],
  .library-footer [hidden],
  .library-footer[hidden] {
    display: none;
  }
  .library-results {
    display: flex;
    flex-direction: column;
  }
  .library-toolbar.toolbar-bottom {
    order: 10;
    position: static;
  }

  .match-count {
    color: var(--primary-color, #03a9f4);
    font-weight: 700;
  }
  .mobile-library-tools,
  .mobile-sort-setting,
  .paging-icon {
    display: none;
  }
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
    padding: 12px 16px;
  }
  .library-tools {
    display: contents;
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
  .purchase-details {
    margin-top: 16px;
  }
  .purchase-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px 16px;
  }
  .purchase-summary dd {
    margin: 0;
    text-align: end;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .view-options {
    display: flex;
    gap: 24px;
    border: 0;
    padding: 0;
    margin: 0;
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
  .scraper-conflict-icon {
    color: #f5bb35;
    text-shadow: 0 1px 3px #000;
    margin-inline-start: 5px;
  }
  .cover-tile > .scraper-conflict-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 4;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    margin: 0;
    border-radius: 50%;
    background: #101316dd;
    font-size: 32px;
    pointer-events: none;
  }
  .cover-image {
    aspect-ratio: 2 / 3;
  }
  .cover-flags {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .cover-text-badges {
    position: absolute;
    inset: 6px 6px auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 4px;
  }
  .cover-text-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-width: 0;
    max-width: 100%;
  }
  .cover-text-flag {
    display: block;
    box-sizing: border-box;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding: 3px 5px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 800;
    line-height: 1.2;
    box-shadow: 0 1px 4px #0008;
  }
  .cover-flag {
    position: absolute;
    top: 0;
    left: 0;
  }
  .cover-recent-edge {
    position: absolute;
    top: 0;
    left: 0;
    width: 64px;
    height: 64px;
    clip-path: polygon(0 0, 100% 0, 0 100%);
    background: linear-gradient(135deg, #bb4eec, #6b1eb9);
  }
  .cover-flag.flag-watched,
  .cover-flag.flag-progress,
  .cover-flag.flag-watch-soon,
  .cover-flag.flag-recent {
    width: 52px;
    height: 52px;
    clip-path: polygon(0 0, 100% 0, 0 100%);
  }
  .cover-flag.flag-watched .badge-symbol,
  .cover-flag.flag-progress .badge-symbol,
  .cover-flag.flag-watch-soon .badge-symbol {
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
  .cover-flag.flag-watch-soon .badge-symbol svg {
    width: 25px;
    height: 25px;
  }
  .cover-flag.flag-recent .badge-symbol {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 30px;
    height: 30px;
  }
  .cover-flag.flag-recent svg {
    width: 100%;
    height: 100%;
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
  .flag-watch-soon {
    background: linear-gradient(135deg, #008bef, #005499);
    color: #fff;
  }
  .flag-recent {
    background: linear-gradient(135deg, #bb4eec, #6b1eb9);
    color: #fff;
  }
  .flag-favorite {
    background: #ffc329;
    color: #241600;
  }
  .cover-text-flag.flag-progress {
    background: #ffbd4a;
    color: #241600;
  }
  .cover-text-flag.flag-watch-soon {
    background: #005e9c;
  }
  .cover-text-flag.flag-recent {
    background: #7130a1;
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
  .format-cinematic,
  .format-eight-k {
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
  .format-hd,
  .format-hd-cinematic {
    background: #236d9e;
    color: #fff;
    border-color: #236d9e;
  }
  .format-sdr {
    background: #176d68;
    color: #fff;
    border-color: #176d68;
  }
  .format-vision,
  .format-atmos {
    font-weight: 500;
    gap: 3px;
  }
  .format-atmos,
  .format-dtsx {
    background: #161616;
    color: #fff;
    border-color: #aaa;
  }
  .dolby-symbol {
    width: 16px;
    height: 11px;
    flex: none;
  }
  .format-hdr10 {
    gap: 3px;
    background: #f1f3f7;
    color: #181d27;
    border-color: #aeb9c8;
    letter-spacing: 0.02em;
  }
  .hdr-symbol {
    width: 19px;
    height: 12px;
    flex: none;
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
    padding: 16px 0 0;
  }
  .movie-dialog {
    width: min(920px, calc(100% - 32px));
    --dialog-gutter: clamp(12px, 2vw, 24px);
    padding: var(--dialog-gutter);
    border-radius: 22px;
    --dialog-background: var(--primary-background-color, #f5f7f6);
    container: movie-modal / inline-size;
  }
  .movie-intro {
    position: relative;
    isolation: isolate;
  }
  .has-backdrop .movie-intro {
    padding-top: clamp(64px, 9cqw, 90px);
  }
  .movie-hero {
    position: absolute;
    inset: calc(-1 * var(--dialog-gutter)) calc(-1 * var(--dialog-gutter)) 0;
    height: auto;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  }
  .movie-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      #0001 20%,
      #0007 50%,
      var(--dialog-background) 100%
    );
  }
  .movie-dialog.has-backdrop {
    --dialog-background: #111416;
    --surface: #1b2023;
    --muted: #bec5c9;
    --line: #ffffff25;
    --primary-text-color: #f4f6f7;
    color: #f4f6f7;
    background: var(--dialog-background);
  }
  .movie-close {
    position: sticky;
    top: 0;
    height: 0;
    z-index: 30;
    display: flex;
    justify-content: flex-end;
    overflow: visible;
  }
  .movie-close .dialog-close {
    background: #111b;
    color: white;
    border-radius: 50%;
  }
  .has-backdrop .movie-intro > .movie-heading {
    position: relative;
    top: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .has-backdrop .movie-heading,
  .has-backdrop .movie-summary,
  .has-backdrop .movie-heading-badges {
    position: relative;
    z-index: 1;
  }
  .has-backdrop .movie-heading {
    color: var(--primary-text-color);
  }
  .has-backdrop .movie-intro .detail-link {
    text-shadow:
      0 1px 3px #000c,
      0 0 6px #0009;
  }
  @media (max-width: 600px) {
    .movie-dialog {
      width: calc(100% - 16px);
      --dialog-gutter: 12px;
      border-radius: 16px;
    }
  }
  .movie-heading {
    display: flex;
    align-items: start;
    gap: 20px;
  }
  .movie-heading h2 {
    flex: 1;
    margin: 0;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.2;
    letter-spacing: -0.025em;
  }
  .movie-heading .detail-link {
    font: inherit;
    text-align: left;
    color: inherit;
    padding: 0;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .movie-ratings {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    margin-inline-start: auto;
    padding-block: 2px;
    color: inherit;
  }
  .score-chip {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
    white-space: nowrap;
  }
  .score-chip img {
    width: 30px;
    height: 30px;
    object-fit: contain;
  }
  .score-ring {
    width: 44px;
    height: 44px;
  }
  .score-ring text {
    font-size: 13px;
    font-weight: 700;
    fill: white;
  }
  .movie-summary {
    margin: 10px 0 12px;
    color: var(--muted);
  }
  .movie-heading-badges {
    margin-bottom: 12px;
  }
  .collection-badge {
    --badge-color: #9aafc1;
    --badge-tint: #334453;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.3;
    padding: 2px 6px;
    min-height: 0;
    border-radius: 999px;
    border: 1px solid var(--badge-color);
    background: linear-gradient(150deg, var(--badge-tint), #101820);
    color: #fff;
    box-shadow: inset 0 1px 3px #ffffff18;
  }
  .collection-badge svg {
    width: 14px;
    height: 14px;
    flex: none;
  }
  .status-badge.status-text {
    border-radius: 3px;
    box-shadow: none;
  }
  .collection-new {
    --badge-color: #27c4f2;
    --badge-tint: #086f95;
  }
  .status-recent {
    --badge-color: #d8acfa;
    --badge-tint: #6b318f;
  }
  .collection-unwatched {
    --badge-color: #ffc107;
    --badge-tint: #795b00;
  }
  .collection-watched {
    --badge-color: #4ee16a;
    --badge-tint: #176d30;
  }
  .collection-favorite {
    --badge-color: #c585f4;
    --badge-tint: #64338b;
  }
  .collection-progress {
    --badge-color: #ffa94d;
    --badge-tint: #86501b;
  }
  .collection-watch-soon {
    --badge-color: #39baff;
    --badge-tint: #075793;
  }
  .movie-dialog .movie-body {
    grid-template-columns: minmax(130px, 190px) minmax(0, 1fr);
    align-items: start;
    padding: clamp(12px, 2vw, 20px);
    gap: clamp(12px, 2vw, 24px);
    background: var(--surface);
    border-radius: 18px;
  }
  .movie-poster {
    width: 100%;
    border-radius: 14px;
  }
  .movie-description {
    min-width: 0;
  }
  .movie-description h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 550;
  }
  .movie-synopsis {
    margin: 10px 0 12px;
  }
  .movie-description hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 16px 0;
  }
  .movie-credits {
    margin: 0;
    display: grid;
    gap: 12px;
  }
  .movie-credits dt {
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .movie-credits dd {
    margin: 0;
    line-height: 1.7;
  }
  .movie-credits .credit-name {
    display: inline-block;
    white-space: nowrap;
    max-width: 100%;
  }
  .movie-purchases {
    margin-top: 12px;
    font-size: 10.5px;
    overflow-wrap: anywhere;
  }
  .movie-record-details {
    margin-top: 12px;
    font-size: 10.5px;
  }
  .movie-record-details > summary,
  .movie-purchases > summary {
    font-size: 12px;
  }
  .movie-purchases .purchase-edit-link {
    font-size: inherit;
  }
  .movie-purchases .summary-edit {
    display: none;
    margin-left: 0.5rem;
    font-size: inherit;
    min-height: 0;
    padding: 0;
    line-height: inherit;
  }
  .movie-purchases[open] .summary-edit {
    display: inline;
  }
  .version-format-badges {
    margin-top: 10px;
  }
  .detail-badges.version-format-badges .format-badge {
    min-height: 22px;
    font-size: 10px;
    padding: 1px 4px;
  }
  .version-format-badges .dolby-symbol {
    width: 14px;
    height: 10px;
  }
  .version-format-badges .hdr-symbol {
    width: 16px;
    height: 10px;
  }
  @container movie-modal (max-width: 600px) {
    .movie-ratings {
      gap: 5px;
    }
    .score-chip {
      gap: 4px;
      font-size: 12px;
    }
    .score-chip img {
      width: 25px;
      height: 25px;
    }
    .score-ring {
      width: 38px;
      height: 38px;
    }
    .has-backdrop .movie-intro {
      padding-top: clamp(100px, 42cqw, 180px);
    }
    .movie-heading {
      gap: 8px;
    }
    .movie-heading h2 {
      font-size: 22px;
    }
    .movie-hero {
      display: block;
      height: clamp(150px, 56cqw, 240px);
      inset-block-end: auto;
      border-radius: 0;
      overflow: hidden;
    }
    .movie-dialog .movie-body {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 8px 12px;
      padding: 0;
      background: transparent;
    }
    .movie-aside {
      display: contents;
    }
    .movie-description {
      display: contents;
    }
    .movie-description > * {
      grid-column: 1 / -1;
    }
    .movie-poster {
      grid-column: 1;
      grid-row: 1 / span 2;
      width: 76px;
      height: 114px;
      border-radius: 8px;
    }
    .movie-description h3 {
      font-size: 16px;
      grid-column: 2;
      grid-row: 1;
    }
    .movie-synopsis {
      grid-column: 2;
      grid-row: 2;
      margin: 0 0 4px;
      font-size: 13px;
      line-height: 1.5;
    }
    .has-backdrop .movie-poster {
      display: none;
    }
    .has-backdrop .movie-description h3,
    .has-backdrop .movie-synopsis {
      grid-column: 1 / -1;
    }
    .movie-description > .detail-badges {
      display: none;
    }
    .movie-record-details {
      grid-column: 1 / -1;
      order: 10;
      margin-top: 0;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .movie-journal {
      grid-column: 1 / -1;
      order: 11;
    }
    .movie-purchases {
      grid-column: 1 / -1;
      order: 12;
    }
    .version-format-badges {
      grid-column: 1 / -1;
      order: 9;
    }
    .movie-credits {
      gap: 10px;
    }
    .movie-credits > div {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 8px;
    }
    .movie-credits dt {
      margin: 0;
      font-size: 10px;
      line-height: 1.5;
    }
    .movie-summary,
    .movie-description {
      font-size: 13px;
    }
    .movie-credits dd {
      line-height: 1.5;
      font-size: 13px;
    }
    .movie-summary {
      margin-block: 8px;
      line-height: 1.4;
    }
    .movie-heading-badges {
      gap: 6px;
      margin-bottom: 10px;
    }
  }
  .facet-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  .facet-groups fieldset {
    min-width: 0;
    border: 0;
    padding: 16px;
    border-radius: 10px;
    background: var(--secondary-background-color, #f7f9f8);
  }
  .facet-groups legend,
  .people-filters legend {
    font-weight: 600;
    float: left;
    width: 100%;
    margin: 0 0 10px;
    padding: 0;
  }
  .facet-groups legend + *,
  .people-filters legend + * {
    clear: both;
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
  .library-footer {
    position: sticky;
    bottom: 0;
    z-index: 7;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    align-items: center;
    padding: 7px 12px max(7px, env(safe-area-inset-bottom));
    margin-top: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-size: 11px;
  }
  .footer-summary {
    flex: 1 1 360px;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    color: var(--muted);
    min-width: 0;
  }
  .footer-actions {
    margin-inline-start: auto;
    gap: 6px;
  }
  .library-footer button {
    min-height: 34px;
    padding: 4px 8px;
    font-size: 11px;
  }
  .library-toolbar > label {
    min-width: 110px;
  }
  .detail-link {
    font: inherit;
    display: inline;
    min-height: 0;
    padding: 2px;
    border-radius: 3px;
    vertical-align: baseline;
  }
  .detail-badges button,
  .detail-badges .collection-badge {
    min-height: 28px;
  }
  .detail-link:hover:not(:disabled) {
    text-decoration: underline;
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
    border: 0;
    padding: 16px;
    border-radius: 10px;
    background: var(--secondary-background-color, #f7f9f8);
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
    .library-page {
      margin-top: 12px;
    }
    .library-toolbar {
      display: block;
      top: max(
        var(--companion-sticky-top, 0px),
        var(--companion-viewport-top, 0px),
        env(safe-area-inset-top, 0px)
      );
      padding: 6px 8px;
      border-radius: 8px 8px 0 0;
    }
    .library-toolbar .desktop-library-search,
    .library-tools,
    .library-toolbar .desktop-library-options {
      display: none;
    }
    .mobile-library-tools {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .mobile-library-tools button {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      min-height: 44px;
      padding: 10px;
      border-radius: 7px;
    }
    .mobile-library-tools svg,
    .paging-icon svg {
      width: 22px;
      height: 22px;
    }
    .active-shortcut {
      color: var(--primary-color, #03a9f4);
      border-color: currentColor;
    }
    .mobile-sort-setting {
      display: block;
    }
    .library-footer {
      flex-wrap: nowrap;
      padding: 4px 8px max(4px, env(safe-area-inset-bottom));
      gap: 4px;
      margin-top: 0;
      border-radius: 6px;
      line-height: 16px;
    }
    .footer-summary {
      flex: 1 1 auto;
      flex-wrap: nowrap;
      overflow: hidden;
      font-size: 10px;
    }
    .footer-summary > span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .footer-summary .footer-admin,
    .paging-label {
      display: none;
    }
    .library-footer .footer-actions {
      flex: none;
      flex-wrap: nowrap;
      gap: 2px;
    }
    .library-footer button {
      display: grid;
      place-items: center;
      min-height: 32px;
      width: 32px;
      padding: 4px;
    }
    .paging-icon {
      display: inline-flex;
    }
    .people-filters {
      grid-template-columns: 1fr;
    }
    .facet-groups {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .facet-groups fieldset,
    .people-filters fieldset {
      padding: 10px;
    }
    .facet-options {
      max-height: min(180px, 30dvh);
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
`, Qe = class Qe extends x {
  constructor() {
    super(...arguments), this.label = "", this.hint = "", this.open = !1, this.hovering = !1, this.focused = !1, this.pinned = !1, this.dismiss = () => {
      clearTimeout(this.closing), this.listeners?.abort(), this.listeners = void 0, this.open = this.pinned = this.hovering = this.focused = !1, this.requestUpdate();
    }, this.position = () => {
      const e = this.renderRoot.querySelector("button"), t = this.renderRoot.querySelector(".balloon");
      if (!this.open || !e || !t) return;
      const i = window.visualViewport, s = i?.width ?? window.innerWidth, r = i?.height ?? window.innerHeight, o = i?.offsetLeft ?? 0, d = i?.offsetTop ?? 0, c = e.getBoundingClientRect(), h = Math.min(320, s - 24);
      t.style.width = `${h}px`;
      const u = t.getBoundingClientRect(), p = Math.max(
        o + 12,
        Math.min(c.left - 8, o + s - h - 12)
      ), m = c.bottom + 10 + u.height > d + r - 12, w = m ? Math.max(d + 12, c.top - u.height - 10) : c.bottom + 10;
      t.style.left = `${p}px`, t.style.top = `${w}px`, t.style.setProperty(
        "--arrow-left",
        `${Math.max(12, Math.min(h - 20, c.left + c.width / 2 - p - 4))}px`
      ), t.toggleAttribute("data-above", m);
    };
  }
  disconnectedCallback() {
    this.dismiss(), super.disconnectedCallback();
  }
  async show() {
    if (clearTimeout(this.closing), this.open) return;
    this.open = !0, this.listeners = new AbortController();
    const { signal: e } = this.listeners;
    document.addEventListener(
      "pointerdown",
      (t) => {
        t.composedPath().includes(this) || this.dismiss();
      },
      { signal: e }
    ), document.addEventListener(
      "keydown",
      (t) => {
        t.key === "Escape" && (t.preventDefault(), t.stopPropagation(), this.dismiss());
      },
      { signal: e, capture: !0 }
    ), document.addEventListener(
      "companion-hint-open",
      (t) => {
        t.detail !== this && this.dismiss();
      },
      { signal: e }
    ), document.dispatchEvent(
      new CustomEvent("companion-hint-open", { detail: this })
    ), window.addEventListener("scroll", this.position, { signal: e, capture: !0 }), window.addEventListener("resize", this.position, { signal: e }), window.visualViewport?.addEventListener("resize", this.position, {
      signal: e
    }), window.visualViewport?.addEventListener("scroll", this.position, {
      signal: e
    }), this.requestUpdate(), await this.updateComplete, this.open && this.isConnected && this.position();
  }
  closeWhenIdle() {
    clearTimeout(this.closing), !this.pinned && !this.focused && !this.hovering && (this.closing = setTimeout(this.dismiss, 120));
  }
  render() {
    return a`<span
      @pointerenter=${(e) => {
      e.pointerType !== "touch" && (this.hovering = !0, this.show());
    }}
      @pointerleave=${() => {
      this.hovering = !1, this.closeWhenIdle();
    }}
      @focusin=${() => {
      this.focused = !0, this.show();
    }}
      @focusout=${() => {
      this.focused = this.pinned = !1, this.closeWhenIdle();
    }}
      ><button
        type="button"
        aria-label=${`Help for ${this.label}`}
        aria-describedby="hint"
        aria-expanded=${this.open}
        @click=${() => {
      this.pinned ? this.dismiss() : (this.pinned = !0, this.show());
    }}
      >
        <span aria-hidden="true">?</span></button
      ><span class="balloon" id="hint" role="tooltip" ?hidden=${!this.open}
        >${this.hint}</span
      ></span
    >`;
  }
};
Qe.properties = {
  label: {},
  hint: {}
}, Qe.styles = C`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    button {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--muted, #52645d);
      cursor: help;
      border-radius: 50%;
    }
    button span {
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      box-sizing: border-box;
      border: 1px solid currentColor;
      border-radius: 50%;
      font: 600 12px/1 system-ui;
    }
    button:hover,
    button[aria-expanded="true"] {
      color: var(--accent, #256b59);
    }
    button:focus-visible {
      outline: 2px solid var(--accent, #256b59);
      outline-offset: 2px;
    }
    .balloon {
      position: fixed;
      z-index: 100;
      box-sizing: border-box;
      padding: 12px 14px;
      border: 1px solid var(--line, #dbe3df);
      border-radius: 10px;
      background: var(--surface, #fff);
      color: var(--primary-text-color, #20302c);
      box-shadow: 0 6px 24px #0003;
      font: 400 13px/1.55 system-ui;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: start;
    }
    .balloon::before {
      content: "";
      position: absolute;
      left: var(--arrow-left, 16px);
      top: -5px;
      width: 8px;
      height: 8px;
      background: inherit;
      border-top: 1px solid var(--line, #dbe3df);
      border-left: 1px solid var(--line, #dbe3df);
      transform: rotate(45deg);
    }
    .balloon[data-above]::before {
      top: auto;
      bottom: -5px;
      transform: rotate(225deg);
    }
    [hidden] {
      display: none;
    }
  `;
let zt = Qe;
customElements.get("kaleidescape-settings-hint") || customElements.define("kaleidescape-settings-hint", zt);
function Si(n, e) {
  return a`<kaleidescape-settings-hint
    .label=${n}
    .hint=${e}
  ></kaleidescape-settings-hint>`;
}
function P(n, e, t) {
  return a`<span class="setting-label"
    ><label for=${n}>${e}</label>${Si(e, t)}
    <span class="setting-description" id=${`${n}-hint`}>${t}</span></span
  >`;
}
const Ss = C`
  .setting-label {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .setting-label label {
    display: inline;
    font-size: 14px;
    font-weight: 600;
  }
  .setting-description {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`, qi = C`
  ${Ss}
  .spaced {
    margin-top: 22px;
  }
  h3 {
    font-size: 18px;
    font-weight: 650;
    letter-spacing: -0.02em;
    margin: 0 0 6px;
  }
  h4 {
    font-size: 15px;
    margin: 0 0 8px;
  }
  p {
    margin: 8px 0 16px;
  }
  .settings-card {
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: clamp(16px, 2.5vw, 24px);
    margin-bottom: 18px;
    background: var(--surface);
    min-width: 0;
  }
  .settings-card > :last-child {
    margin-bottom: 0;
  }
  .section-heading {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .section-heading p {
    margin: 6px 0 0;
    max-width: 70ch;
    color: var(--muted);
    font-size: 14px;
  }
  .scope-tag {
    display: inline-flex;
    padding: 4px 9px;
    border: 1px solid var(--line);
    border-radius: 20px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 650;
    white-space: nowrap;
  }
  .scope-tag.immediate {
    color: var(--accent);
  }
  .setting-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    min-width: 0;
  }
  .setting-field small {
    font-weight: 400;
    font-size: 12px;
  }
  .credential-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  .credential-row .setting-field {
    flex: 1;
  }
  .credential-actions {
    display: flex;
    align-items: center;
  }
  .check {
    display: flex;
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    align-items: start;
  }
  .settings-grid .full {
    grid-column: 1 / -1;
  }
  .field-input {
    display: flex;
    align-items: center;
    position: relative;
  }
  .field-input input {
    min-width: 0;
    padding-inline-end: 80px;
  }
  .field-input .unit {
    position: absolute;
    inset-inline-end: 12px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
    pointer-events: none;
  }
  .switch-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 18px;
    padding: 16px 0;
    border-bottom: 1px solid var(--line);
    margin: 0;
    cursor: pointer;
  }
  .switch-row:last-child {
    border-bottom: 0;
  }
  .switch-row > span {
    flex: 1;
    min-width: 0;
  }
  .switch-row strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }
  .switch-row small {
    display: block;
    margin-top: 5px;
  }
  .switch-row input {
    appearance: none;
    flex: 0 0 40px;
    width: 40px;
    height: 24px;
    min-height: 24px;
    padding: 0;
    margin: 0;
    border-radius: 14px;
    border: 1px solid var(--muted);
    background: var(--line);
    position: relative;
    cursor: pointer;
  }
  .switch-row input::before {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    background: var(--muted);
    transition: transform 0.15s;
  }
  .switch-row input:checked {
    border-color: var(--accent);
    background: var(--accent);
  }
  .switch-row input:checked::before {
    background: var(--surface);
    transform: translateX(16px);
  }
  .switch-row input:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .setting-help {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px 14px;
    margin-top: 18px;
    font-size: 13px;
  }
  .setting-help summary {
    color: var(--accent);
    font-weight: 550;
    cursor: pointer;
  }
  .setting-help p:last-child {
    margin-bottom: 0;
  }
  .settings-note {
    border-inline-start: 3px solid var(--accent);
    padding: 10px 14px;
    color: var(--muted);
    font-size: 13px;
    background: var(--primary-background-color, #f5f7f6);
  }
  .settings-grid input,
  .settings-grid textarea,
  .settings-grid select {
    width: 100%;
  }
  .settings-card a {
    color: var(--accent);
    text-underline-offset: 3px;
  }
  @media (max-width: 600px) {
    .settings-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    .settings-card {
      border-radius: 10px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .switch-row input::before {
      transition: none;
    }
  }
  @media (forced-colors: active) {
    .switch-row input {
      appearance: auto;
    }
    .switch-row input::before {
      display: none;
    }
  }
`, ka = C`
  .remote-dialog {
    width: min(390px, calc(100% - 24px));
    --dialog-gutter: 16px;
    padding: var(--dialog-gutter);
    border-radius: 24px;
  }
  .remote-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
  .remote-player {
    margin: 0;
    flex: 1;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .remote-round {
    border-radius: 50%;
    width: 44px;
    min-height: 44px;
    padding: 0;
    font-size: 22px;
  }
  .remote-navigation {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 12px 0;
  }
  .remote-navigation button,
  .remote-resume {
    border-radius: 999px;
    padding: 10px 8px;
  }
  .remote-pad {
    position: relative;
    width: min(
      100%,
      clamp(
        176px,
        calc(var(--companion-viewport-height, 100dvh) - 390px),
        260px
      )
    );
    aspect-ratio: 1;
    border-radius: 50%;
    margin: 12px auto;
    background: var(--secondary-background-color, #e0e6ec);
    border: 2px solid var(--line);
  }
  .remote-pad button {
    position: absolute;
    border: 0;
    background: transparent;
    padding: 0;
    border-radius: 50%;
    font-size: 30px;
  }
  .remote-pad .remote-up {
    top: 1%;
    left: 33%;
    width: 34%;
    height: 27%;
  }
  .remote-pad .remote-down {
    bottom: 1%;
    left: 33%;
    width: 34%;
    height: 27%;
  }
  .remote-pad .remote-left {
    top: 33%;
    left: 1%;
    width: 27%;
    height: 34%;
  }
  .remote-pad .remote-right {
    top: 33%;
    right: 1%;
    width: 27%;
    height: 34%;
  }
  .remote-pad .remote-select {
    inset: 25%;
    width: 50%;
    height: 50%;
    background: var(--surface);
    border: 2px solid var(--line);
    font-size: 15px;
    font-weight: 700;
  }
  .remote-transport {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 0;
    border-top: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .remote-resume {
    width: 100%;
  }
  @media (max-width: 380px) {
    .remote-dialog {
      --dialog-gutter: 12px;
      width: calc(100% - 16px);
    }
    .remote-navigation button {
      font-size: 13px;
    }
    .remote-transport {
      gap: 4px;
    }
  }
`;
function Xi(n, e, t, i) {
  const s = (r, o, d, c = "") => a` <button
      type="button"
      class=${c}
      aria-label=${o}
      title=${o}
      ?disabled=${e || !t && !r.startsWith("power_")}
      @click=${() => i(r)}
    >
      <span aria-hidden="true">${d}</span>
    </button>`;
  return a`
    <div class="remote-top">
      <p class="remote-player">${n}</p>
      ${s("power_on", "Power on", "⏻", "remote-round")}
      ${s("power_off", "Standby", "☾", "remote-round")}
    </div>
    <div class="remote-navigation">
      <button ?disabled=${e || !t} @click=${() => i("movies")}>
        ▦ Covers
      </button>
      <button ?disabled=${e || !t} @click=${() => i("menu")}>
        ☰ Menu
      </button>
      <button ?disabled=${e || !t} @click=${() => i("back")}>
        ↶ Back
      </button>
    </div>
    <div class="remote-pad" role="group" aria-label="Directional controls">
      ${s("up", "Up", "⌃", "remote-up")}
      ${s("left", "Left", "‹", "remote-left")}
      ${s("select", "Select", "SELECT", "remote-select")}
      ${s("right", "Right", "›", "remote-right")}
      ${s("down", "Down", "⌄", "remote-down")}
    </div>
    <div class="remote-transport">
      ${s("previous", "Previous chapter", "|◀", "remote-round")}
      ${s("stop", "Stop", "■", "remote-round")}
      ${s("play", "Play selection", "▶", "remote-round primary")}
      ${s("pause", "Pause", "Ⅱ", "remote-round")}
      ${s("next", "Next chapter", "▶|", "remote-round")}
    </div>
    <button
      class="remote-resume"
      ?disabled=${e || !t}
      @click=${() => i("resume")}
    >
      ▶ Resume Playback
    </button>
  `;
}
const $a = {
  state_observed: "The requested playback state was observed.",
  acknowledged: "The player accepted the command; its final state is not confirmed.",
  unconfirmed: "The command may have executed. An administrator must inspect the player before more commands can be sent. Nothing will be replayed automatically.",
  rejected: "The player rejected the command. Nothing was retried.",
  not_sent: "Settings or access changed before sending. The command was not sent."
}, Je = class Je extends x {
  constructor() {
    super(...arguments), this.mode = "remote", this.versionId = "", this.playerId = "", this.inlineRemote = !1, this.value = "", this.configured = !0, this.settingsDisabled = !1, this.generation = 0, this.key = "", this.waking = !1, this.wakeDeadline = 0, this.started = "", this.lastOperation = "", this.selectedPlayer = "", this.dialog = "players", this.acknowledge = "", this.busy = !1, this.revalidatingVersion = !1, this.error = "", this.notice = "", this.locked = !1;
  }
  willUpdate(e) {
    if (!["scope", "client", "versionId", "playerId"].some(
      (i) => e.has(i)
    ))
      return;
    const t = this.scope?.permissions.read ? `${this.scope.entry_id}:${this.scope.dataset_id}:${!!this.scope.permissions.edit}:${this.versionId}:${this.playerId}` : "";
    if (t !== this.key || this.client !== this.boundClient) {
      const i = e.has("versionId") && !e.has("scope") && !e.has("client") && !e.has("playerId") && !!this.key && !!t;
      (this.client !== this.boundClient || !this.key || !t || this.key.split(":").slice(0, 3).join(":") !== t.split(":").slice(0, 3).join(":")) && (this.selectedPlayer = ""), this.generation++, this.key = t, this.boundClient = this.client, this.revalidatingVersion = i && !!this.info, i || (this.info = this.status = void 0), this.pending = void 0, this.stopWaking(), this.busy = !1, this.acknowledge = this.error = this.notice = this.started = this.lastOperation = "", this.playerId && (this.selectedPlayer = this.playerId), t && this.client && this.load(!0, this.revalidatingVersion);
    }
  }
  updated() {
    const e = this.busy || !!this.pending;
    e !== this.locked && (this.locked = e, this.dispatchEvent(
      new CustomEvent("control-lock", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    ));
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.generation++, this.stopWaking(), this.revalidatingVersion = !1, this.pending = this.info = void 0;
  }
  fail(e) {
    const t = g(e), i = {
      control_disabled: "Playback controls are disabled. Ask an administrator to enable them.",
      control_player: "No player is configured. Ask an administrator to discover and select one.",
      control_not_ready: "The player is not ready. Power it on and wait for readiness before playing.",
      control_unreachable: "The player could not be reached. Inspect its connection and state.",
      control_identity: "Live device/movie identity did not match. Refresh the selected player.",
      control_source: "Title playback requires the control seed to match the Library host.",
      control_handle: "This version has no verified playback-handle mapping yet.",
      control_launch_disabled: "Experimental Library playback is disabled in integration settings.",
      control_uncertain: "An administrator must inspect and acknowledge the previous uncertain command.",
      control_limit: "Control receipt storage is full. Administrator maintenance is required."
    };
    this.error = i[t] ?? y(e), t === "unauthorized" && (this.generation++, this.info = this.pending = this.status = void 0, this.selectedPlayer = "", this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async load(e = !1, t = !1) {
    const i = this.generation;
    try {
      const s = await this.client.controlInfo(this.scope);
      if (i !== this.generation) return;
      this.info = s, s.players.some((r) => r.id === this.selectedPlayer) || (this.selectedPlayer = s.default_player || s.players[0]?.id || ""), e && s.enabled && this.selectedPlayer && this.mode !== "settings" && await this.readStatus();
    } catch (s) {
      i === this.generation && (t && (this.info = this.status = void 0), this.fail(s));
    }
    i === this.generation && (t && (this.revalidatingVersion = !1), this.requestUpdate());
  }
  async action(e) {
    if (this.busy || this.revalidatingVersion || !this.client || !this.scope?.permissions.read)
      return;
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      await e();
    } catch (i) {
      t === this.generation && this.fail(i);
    } finally {
      if (t === this.generation && (this.busy = !1, this.requestUpdate(), await this.updateComplete, this.started)) {
        const i = this.started;
        this.started = "", this.dispatchEvent(
          new CustomEvent("playback-started", {
            detail: i,
            bubbles: !0,
            composed: !0
          })
        );
      }
    }
  }
  async discover() {
    !this.scope?.permissions.edit || this.mode === "settings" && (this.settingsDisabled || !this.configured) || await this.action(async () => {
      const e = this.generation, t = await this.client.controlDiscover(this.scope);
      e === this.generation && (this.info = t);
    });
  }
  stopWaking() {
    clearTimeout(this.wakeTimer), this.wakeTimer = void 0, this.waking = !1;
  }
  async readStatus() {
    const e = this.generation, t = this.selectedPlayer, i = await this.client.controlStatus(
      this.scope,
      t || void 0
    );
    e === this.generation && t === this.selectedPlayer && (this.status = i, i.ready ? this.stopWaking() : i.readiness === "starting" && !this.waking && (this.waking = !0, this.wakeDeadline = Date.now() + 12e4, this.wakeTimer = setTimeout(() => {
      this.pollWake();
    }, 2e3)), this.requestUpdate());
  }
  async pollWake() {
    const e = this.generation;
    let t = 2e3;
    try {
      await this.readStatus();
    } catch {
      t = 3e4;
    }
    e !== this.generation || !this.waking || !this.isConnected || (Date.now() >= this.wakeDeadline ? (this.stopWaking(), this.notice = "The player is still starting or unavailable. Check its state before playing.") : this.wakeTimer = setTimeout(() => {
      this.pollWake();
    }, t), this.requestUpdate());
  }
  async refresh() {
    await this.action(async () => {
      await this.readStatus(), await this.load();
    });
  }
  async prepare(e) {
    this.pending || await this.action(async () => {
      const t = this.generation, i = await this.client.controlPrepare(
        this.scope,
        e,
        e === "launch" && this.versionId || void 0,
        this.selectedPlayer || void 0
      );
      t === this.generation && (this.lastOperation = e, this.pending = this.client.prepareControl(this.scope, i.token), await this.send());
    });
  }
  async send() {
    if (!this.pending) return;
    const e = this.generation, t = await this.client.controlExecute(this.pending);
    if (e !== this.generation) return;
    this.notice = $a[t.outcome], this.pending = void 0;
    const i = this.lastOperation;
    if (["state_observed", "acknowledged"].includes(t.outcome) && (i === "power_on" ? (this.waking = !0, this.wakeDeadline = Date.now() + 12e4, this.wakeTimer = setTimeout(() => {
      this.pollWake();
    }, 1e3)) : ["launch", "play", "resume"].includes(i) && (this.started = this.selectedPlayer)), await this.load(), i !== "power_on")
      try {
        await this.readStatus();
      } catch {
        this.status = void 0;
      }
  }
  close(e) {
    e?.preventDefault(), this.stopWaking(), this.generation++, this.busy = !1, this.pending = void 0, this.client && this.scope && this.load(), this.acknowledge = "", this.renderRoot.querySelector("dialog")?.close(), this.dialog = "players", this.requestUpdate();
  }
  async openRemote() {
    if (this.busy || this.pending) return;
    const e = this.generation;
    this.dialog = "remote", this.acknowledge = "", this.requestUpdate(), await this.updateComplete, e === this.generation && this.isConnected && this.renderRoot.querySelector("dialog")?.showModal();
  }
  async choosePlayer() {
    if (this.busy || this.pending) return;
    const e = this.generation;
    this.acknowledge = "", this.dialog = "players", this.requestUpdate(), await this.updateComplete, !(e !== this.generation || !this.isConnected) && this.renderRoot.querySelector("dialog")?.showModal();
  }
  async reviewPending(e) {
    if (!this.scope?.permissions.edit || !this.info?.can_manage) return;
    const t = this.generation;
    this.acknowledge = e, this.requestUpdate(), await this.updateComplete, !(t !== this.generation || !this.isConnected) && this.renderRoot.querySelector("dialog")?.showModal();
  }
  async confirmReview() {
    !this.acknowledge || !this.info?.can_manage || !this.scope?.permissions.edit || await this.action(async () => {
      const e = this.generation;
      await this.client.controlAcknowledge(this.scope, this.acknowledge), e === this.generation && (this.acknowledge = "", this.renderRoot.querySelector("dialog")?.close(), await this.load());
    });
  }
  feedback() {
    return a`
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      ${this.pending ? a`<p class="warning">
                The result is not confirmed. Check the same request; it will not
                replay an accepted command.
              </p>
              <button
                ?disabled=${this.busy}
                @click=${() => this.action(() => this.send())}
              >
                Check command result
              </button>` : l}
      ${this.notice ? a`<p role="status">${this.notice}</p>` : l}
    `;
  }
  render() {
    if (!this.scope?.permissions.read || this.mode === "settings" && !this.scope.permissions.edit)
      return l;
    const e = this.info;
    if (this.mode === "movie" && (!e?.enabled || !e.allow_launch))
      return a`<div class="movie-actions">
        <slot name="collection"></slot>
      </div>`;
    const t = e?.devices?.filter((o) => o.is_player) ?? [], i = e?.players.find(
      (o) => o.id === this.selectedPlayer
    ), s = e?.blocked_players.includes(this.selectedPlayer), r = this.busy || this.revalidatingVersion || this.waking || !e?.enabled || !this.selectedPlayer || !!this.pending || s;
    return a`<section
      class=${this.mode === "remote" ? "card control-card" : "device-controls"}
    >
      ${this.mode === "remote" ? a`<div class="card-head">
              <h2>Player controls</h2>
              <button
                type="button"
                ?disabled=${r}
                ?hidden=${this.inlineRemote}
                @click=${this.openRemote}
              >
                Remote
              </button>
              <button
                ?disabled=${this.busy || !e?.enabled || !this.selectedPlayer}
                @click=${this.refresh}
              >
                Refresh player state</button
              ><button
                ?disabled=${this.busy || !e?.enabled || !!this.pending}
                ?hidden=${(e?.players.length ?? 0) < 2}
                @click=${this.choosePlayer}
              >
                Choose Player
              </button>
            </div>` : l}
      ${this.mode === "settings" ? a`
              <div class="actions">
                <button
                  type="button"
                  ?disabled=${this.busy || this.settingsDisabled || !e?.enabled || !this.configured}
                  @click=${this.discover}
                >
                  ${this.busy ? "Discovering…" : "Discover devices"}
                </button>
              </div>
              ${!e?.enabled || !this.configured ? a`<p class="muted">Save the enabled control hostname before discovering devices.</p>` : l}
              <div>
                ${P("control_player", "Default player", "Discover devices using the saved Kaleidescape Player Address, then choose the movie player Companion should use by default. Save this selection to apply it. This does not change the player observed for Journal recording or send a playback command.")}<select
                  name="control_player"
                  id="control_player"
                  aria-describedby="control_player-hint"
                  .value=${this.value}
                  ?disabled=${this.busy || this.settingsDisabled}
                  @change=${(o) => this.dispatchEvent(new CustomEvent("player-selected", { detail: o.target.value, bubbles: !0, composed: !0 }))}
                >
                  <option value="" ?selected=${!this.value}>
                    No default player selected
                  </option>
                  ${this.value && !t.some((o) => o.serial === this.value) ? a`<option value=${this.value} selected>Configured player (${this.value})</option>` : l}
                  ${t.map((o) => a`<option value=${o.serial} ?selected=${o.serial === this.value}>${o.name || o.model || "Movie player"} (${o.serial})</option>`)}
                </select>
              </div>
              ${e?.devices?.length ? a`<details>
                      <summary>
                        Discovered components (${e.devices.length})
                      </summary>
                      <ul>
                        ${e.devices.map((o) => a`<li>${o.name} · ${o.model} · ${o.ipaddress} · ${o.is_player ? "Player" : "Server/component"}</li>`)}
                      </ul>
                    </details>` : l}
            ` : this.mode === "movie" ? a`
                <div class="movie-actions">
                  <button
                    type="button"
                    class=${`primary play-movie ${this.status?.ready ? "is-play" : "is-power"}`}
                    ?disabled=${r}
                    aria-busy=${this.waking || this.busy}
                    title=${`${this.status?.ready ? "Play on" : "Power on"} ${i?.name || "the selected player"}`}
                    @click=${() => this.status && this.status.readiness !== "starting" ? this.prepare(this.status.ready ? "launch" : "power_on") : this.refresh()}
                  >
                    ${R(this.status?.ready && !this.waking ? "play" : "power")}
                    ${this.waking ? a`<span class="spinner" aria-hidden="true">◌</span> Starting player…` : !this.status || this.status.readiness === "starting" ? "Check player" : this.status.ready ? "Play" : "Power On"}</button
                  ><button
                    type="button"
                    ?disabled=${this.busy || this.revalidatingVersion || this.waking || !!this.pending}
                    ?hidden=${(e?.players.length ?? 0) < 2}
                    @click=${this.choosePlayer}
                  >
                    Choose Player</button
                  ><slot name="collection"></slot>
                </div>
                ${(e?.players.length ?? 0) > 1 || !i ? a`<p class="muted player-target">${i ? `On ${i.name}` : "Choose a player to start playback"}</p>` : l}
              ` : e?.enabled ? a`
                  ${this.waking ? a`<span role="status">◌ Starting player…</span>` : l}
                ` : a`<p class="muted">Playback controls are disabled.</p>`}
      ${this.mode === "remote" && this.inlineRemote && e?.enabled ? Xi(i?.name || "Kaleidescape player", !!r, !!this.status?.ready, (o) => {
      this.prepare(o);
    }) : l}
      ${this.dialog !== "remote" || this.acknowledge ? this.feedback() : l}
      ${s && !(e?.can_manage && this.scope.permissions.edit) ? a`<p class="warning">This player needs administrator review of an uncertain command before more commands can be sent.</p>` : l}
      ${e?.can_manage && this.scope.permissions.edit ? e.pending.map((o) => a`<p class="warning">Unconfirmed ${o.operation} for ${e.players.find((d) => d.id === o.player_id)?.name || "a previously selected player"}. <button type="button" ?disabled=${this.busy} @click=${() => this.reviewPending(o.request_id)}>I inspected the player…</button></p>`) : l}
      <dialog
        ?data-admin-dialog=${!!this.acknowledge}
        class=${this.dialog === "remote" && !this.acknowledge ? "database-dialog remote-dialog" : "database-dialog"}
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.acknowledge ? "Review unconfirmed command" : this.dialog === "remote" ? "Theater Remote" : "Choose Player"}
          </h2>
          ${S((o) => this.close(o))}
        </div>
        ${this.acknowledge ? a`<p>
                Confirm you inspected the physical player. This permits new
                commands and does not resend the earlier command.
              </p>` : this.dialog === "remote" ? a`${Xi(
      i?.name || "Kaleidescape player",
      !!r,
      !!this.status?.ready,
      (o) => {
        this.prepare(o);
      }
    )}${this.feedback()}` : a`
                  <p class="muted">
                    Choose where to play. This does not change the household
                    default player or Journal tracking.
                  </p>
                  <div class="player-options">
                    ${e?.players.map(
      (o) => a`<button
                          class="player-choice"
                          type="button"
                          aria-pressed=${o.id === this.selectedPlayer}
                          @click=${() => {
        this.selectedPlayer = o.id, this.status = void 0, this.stopWaking(), this.close(), this.dispatchEvent(
          new CustomEvent("player-changed", {
            detail: o.id,
            bubbles: !0,
            composed: !0
          })
        ), this.refresh(), this.requestUpdate();
      }}
                        >
                          ${o.name}${o.model ? a`<small>${o.model}</small>` : l}${o.id === e.default_player ? a`<small>Household default</small>` : l}
                        </button>`
    )}
                  </div>
                  ${e?.players.length ? l : a`<p>No players are available. Ask an administrator to discover devices in Settings.</p>`}
                `}
        ${this.acknowledge ? a`<div class="dialog-footer"><button type="button" class="primary" ?disabled=${this.busy} @click=${this.confirmReview}>Acknowledge review</button></div>` : l}
      </dialog>
    </section>`;
  }
};
Je.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  mode: {},
  versionId: {},
  playerId: {},
  inlineRemote: { type: Boolean },
  value: {},
  configured: { type: Boolean },
  settingsDisabled: { type: Boolean }
}, Je.styles = [
  E,
  Ss,
  ka,
  C`
      [hidden] {
        display: none !important;
      }
      .control-card {
        margin-top: 20px;
        padding: 20px;
      }
      .control-card > .card-head {
        padding: 0;
        flex-wrap: wrap;
      }
      .movie-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;
      }
      .movie-actions button {
        border-radius: 999px;
        padding: 10px 20px;
        min-height: 44px;
        line-height: 20px;
      }
      .play-movie {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .play-movie.is-power {
        background: #238548;
        border-color: #238548;
        color: #fff;
      }
      .play-movie.is-play {
        background: #008fb5;
        border-color: #008fb5;
        color: #fff;
      }
      .spinner {
        display: inline-block;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
      }
      .play-movie svg {
        width: 20px;
        height: 20px;
      }
      .player-options {
        display: grid;
        gap: 10px;
        margin: 20px 0;
      }
      .player-choice {
        text-align: left;
        padding: 14px;
        border-radius: 10px;
      }
      .player-choice small {
        display: block;
      }
      .player-target {
        margin: 8px 0 0;
        font-size: 12px;
      }
      @media (max-width: 600px) {
        .control-card {
          margin-top: 12px;
          padding: 12px;
        }
        .movie-actions {
          gap: 8px;
        }
        .movie-actions button {
          padding-inline: 12px;
          font-size: 13px;
        }
      }
    `
];
let jt = Je;
customElements.get("kaleidescape-device-controls") || customElements.define("kaleidescape-device-controls", jt);
const Wi = [
  "close",
  "cancel",
  "control-lock",
  "edit-lock",
  "scrape-lock",
  "collection-lock"
];
class Ca {
  constructor(e, t) {
    this.host = e, this.change = t, this.profile = te(), this.schedule = () => {
      this.frame !== void 0 || te() === this.profile || (this.frame = requestAnimationFrame(() => {
        this.frame = void 0;
        const i = te();
        this.host.isConnected && i !== this.profile && this.change() && (this.profile = i);
      }));
    };
  }
  hostConnected() {
    window.addEventListener("resize", this.schedule);
    for (const e of Wi)
      this.host.renderRoot.addEventListener(e, this.schedule, !0);
  }
  hostUpdated() {
    this.schedule();
  }
  hostDisconnected() {
    window.removeEventListener("resize", this.schedule);
    for (const e of Wi)
      this.host.renderRoot.removeEventListener(e, this.schedule, !0);
    this.frame !== void 0 && cancelAnimationFrame(this.frame), this.frame = void 0;
  }
}
function Ce(n, e) {
  n.addController(new Ca(n, e));
}
class O {
  constructor(e, t, i, s, r = "library") {
    this.client = e, this.scope = t, this.shared = i, this.error = s, this.area = r, this.values = {}, this.revision = 0, this.profile = te(), this.active = !0, this.inflight = 0, this.sequence = 0, this.versions = /* @__PURE__ */ new Map(), this.failed = {};
  }
  get unsettled() {
    return this.inflight > 0 || Object.keys(this.failed).length > 0;
  }
  async load() {
    const e = await this.client.uiPreferences(
      this.scope,
      this.shared,
      this.area,
      this.profile
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
          this.area,
          this.profile
        )
      );
    } catch (s) {
      i = Promise.reject(s);
    }
    this.inflight++, i.then((s) => {
      this.active && (this.revision = Math.max(this.revision, s.revision), Object.keys(this.failed).length || this.error(null));
    }).catch((s) => {
      if (this.active) {
        for (const [r, o] of Object.entries(e))
          this.versions.get(r) === t && (this.failed[r] = o);
        Object.keys(this.failed).length && this.error(s);
      }
    }).finally(() => {
      this.inflight--;
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
const Y = [
  "8K",
  "4K Cinematic",
  "4K",
  "HD Cinematic",
  "HD",
  "SD",
  "SDR",
  "HDR10",
  "Dolby Vision",
  "Dolby Atmos",
  "DTS:X"
];
function Le(n) {
  return n.movie_statuses ?? (["unwatched", "watched", "in_progress"].includes(n.watched_status) ? [n.watched_status] : []);
}
function U(n, e = "modern") {
  return {
    unwatched: e === "modern" ? "Unwatched" : "New",
    watched: e === "modern" ? "Watched" : "Played",
    in_progress: e === "modern" ? "In progress" : "Paused",
    unknown: "Unknown",
    none: "No status"
  }[n] ?? "Unknown";
}
function Sa(n, e = "modern") {
  const t = n.is_watch_soon ?? n.collections.some(
    (s) => s.toLowerCase().replace(/[\s_-]+/g, "") === "watchsoon"
  ), i = Le(n);
  return [
    ...i.includes("in_progress") ? [
      {
        key: "progress",
        label: U("in_progress", e),
        symbol: "◔"
      }
    ] : [],
    ...i.includes("watched") ? [
      {
        key: "watched",
        label: U("watched", e),
        symbol: "✓"
      }
    ] : [],
    ...!i.includes("in_progress") && !i.includes("watched") && t ? [{ key: "watch-soon", label: "Watch Soon", symbol: "" }] : [],
    ...i.includes("unwatched") ? [
      {
        key: "unwatched",
        label: U("unwatched", e),
        symbol: U("unwatched", e)
      }
    ] : [],
    ...n.is_recently_added ? [{ key: "recent", label: "Recently Added", symbol: "Recently Added" }] : [],
    ...n.is_favorite ? [{ key: "favorite", label: "Favorites", symbol: "★" }] : []
  ];
}
function we(n) {
  const e = (n.formats ?? [n.edition ?? ""]).map(
    (s) => s.toLowerCase()
  ), t = (s) => e.some((r) => s.test(r)), i = [];
  return t(/\b8k\b/) && i.push({ key: "eight-k", label: "8K" }), e.some(
    (s) => /\b4k\b/.test(s) && !/\bcinematic\b/.test(s)
  ) && i.push({ key: "four-k", label: "4K" }), e.some((s) => /\b4k\b/.test(s) && /\bcinematic\b/.test(s)) && i.push({ key: "cinematic", label: "4K Cinematic" }), e.some((s) => /\bhd\b/.test(s) && /\bcinematic\b/.test(s)) && i.push({ key: "hd-cinematic", label: "HD Cinematic" }), e.some(
    (s) => /\bhd\b|\b1080p\b/.test(s) && !/\bcinematic\b/.test(s)
  ) && i.push({ key: "hd", label: "HD" }), t(/\bsd\b|\b(?:480|576)[pi]\b/) && i.push({ key: "sd", label: "SD" }), t(/\bsdr\b/) && i.push({ key: "sdr", label: "SDR" }), t(/\bhdr10\b/) && i.push({ key: "hdr10", label: "HDR10" }), t(/\bdolby\s*vision\b/) && i.push({ key: "vision", label: "Dolby Vision" }), t(/\bdolby\s*atmos\b/) && i.push({ key: "atmos", label: "Dolby Atmos" }), t(/\bdts\s*[:-]\s*x\b/) && i.push({ key: "dtsx", label: "DTS:X" }), i;
}
function qa(n) {
  const e = we(n);
  return ["eight-k", "cinematic", "four-k", "hd-cinematic", "hd", "sd"].map((t) => e.find((i) => i.key === t)).find(Boolean);
}
const Ea = $`<svg class="dolby-symbol" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M1 1h3.1c4.1 0 7 2.9 7 7s-2.9 7-7 7H1V1Zm22 0h-3.1c-4.1 0-7 2.9-7 7s2.9 7 7 7H23V1Z" />
</svg>`, Aa = $`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M12 6v6h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`, La = $`<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M13 3c.6 0 1 .4 1.2 1l1.4 5.2a5.8 5.8 0 0 0 4.1 4.1l5.2 1.4c.6.2 1 .6 1 1.2s-.4 1-1 1.2l-5.2 1.4a5.8 5.8 0 0 0-4.1 4.1l-1.4 5.2c-.2.6-.6 1-1.2 1s-1-.4-1.2-1l-1.4-5.2a5.8 5.8 0 0 0-4.1-4.1L1 17.1c-.6-.2-1-.6-1-1.2s.4-1 1-1.2l5.2-1.4a5.8 5.8 0 0 0 4.1-4.1L11.8 4c.2-.6.6-1 1.2-1Z" />
  <path fill="currentColor" d="M26 1c.5 0 .8.3.9.7l.6 2.1a2.7 2.7 0 0 0 1.9 1.9l2.1.6c.3.1.5.4.5.8s-.2.7-.5.8l-2.1.6a2.7 2.7 0 0 0-1.9 1.9l-.6 2.1c-.1.4-.4.7-.9.7s-.8-.3-.9-.7l-.6-2.1a2.7 2.7 0 0 0-1.9-1.9l-2.1-.6c-.3-.1-.5-.4-.5-.8s.2-.7.5-.8l2.1-.6a2.7 2.7 0 0 0 1.9-1.9l.6-2.1c.1-.4.4-.7.9-.7Z" />
  <path fill="currentColor" d="M5 23c.5 0 .8.3.9.7l.5 1.7a2.3 2.3 0 0 0 1.6 1.6l1.7.5c.4.1.6.4.6.8s-.2.7-.6.8l-1.7.5a2.3 2.3 0 0 0-1.6 1.6l-.5 1.7c-.1.4-.4.6-.9.6s-.8-.2-.9-.6l-.5-1.7A2.3 2.3 0 0 0 2 29.6l-1.7-.5c-.4-.1-.6-.4-.6-.8s.2-.7.6-.8L2 27a2.3 2.3 0 0 0 1.6-1.6l.5-1.7c.1-.4.4-.7.9-.7Z" />
</svg>`, Ra = $`<svg class="hdr-symbol" viewBox="0 0 27 16" aria-hidden="true" focusable="false">
  <path fill="#e94637" d="M1 4 7 3v10l-6-1z" />
  <path fill="#f28c28" d="M6 3 12 2v12l-6-1z" />
  <path fill="#edc13b" d="M11 2 17 1v14l-6-1z" />
  <path fill="#72ad69" d="M16 1 22 0v16l-6-1z" />
  <path fill="#298a98" d="M21 1 26 0v16l-5-1z" />
</svg>`;
function F(n, e = !1, t, i = !1) {
  const s = e ? qa(n) : void 0;
  return (e ? [
    ...s ? [s] : [],
    ...we(n).filter(
      (r) => ["atmos", "dtsx"].includes(r.key)
    )
  ] : we(n)).map((r) => {
    const o = r.key === "cinematic" || r.key === "hd-cinematic" ? a`<b>${r.key === "cinematic" ? "4K" : "HD"}</b
            ><span class="cinematic-label">Cinematic</span>` : r.key === "vision" || r.key === "atmos" ? a`${Ea}<span>${r.label}</span>` : r.key === "hdr10" ? a`${Ra}<b>HDR10</b>` : r.label;
    return t ? a`<button
          type="button"
          class=${`format-badge format-${r.key}`}
          aria-label=${`Filter by format: ${r.label}`}
          ?disabled=${i}
          @click=${() => t(r.label)}
        >
          ${o}
        </button>` : a`<span
          class=${`format-badge format-${r.key}`}
          aria-label=${r.label}
          >${o}</span
        >`;
  });
}
function Ki(n, e = !1, t = [], i = "modern", s = "icons") {
  const r = Sa(n, i), o = e ? ["progress", "watched", "watch-soon", "recent"].map((d) => r.find((c) => c.key === d)).find(Boolean) : void 0;
  if (e && s === "text") {
    const d = o && !t.includes(o.key) ? o : void 0, c = r.find((m) => m.key === "recent"), h = d && d.key !== "recent" && c && !t.includes("recent"), u = r.find(
      (m) => m.key === "favorite" && !t.includes("favorite")
    ), p = (m) => a`<span
        class=${`cover-text-flag flag-${m.key}`}
        role="img"
        aria-label=${m.label}
        title=${m.label}
        >${m.label}</span
      >`;
    return a`<div class="cover-text-badges">
      <div class="cover-text-stack">
        ${d ? p(d) : l}${h ? p(c) : l}
      </div>
      ${u ? p(u) : l}
    </div>`;
  }
  return (e ? r.filter((d) => d === o || d.key === "favorite") : r).filter((d) => !t.includes(d.key)).map((d) => {
    const c = e && d === o && d.key !== "recent" && !t.includes("recent") && r.some((h) => h.key === "recent");
    return a`${c ? a`<span class="cover-recent-edge" role="img" aria-label="Recently Added" title="Recently Added"></span>` : l}<span
          class=${e ? `cover-flag flag-${d.key}` : `status-badge collection-badge collection-${wt(d.label)}${d.key === "recent" ? " status-recent" : ""}${s === "text" ? " status-text" : ""}`}
          title=${d.label}
          aria-label=${d.label}
          role="img"
          >${e ? a`<span class="badge-symbol" aria-hidden="true">${d.key === "watch-soon" ? Aa : d.key === "recent" ? La : d.symbol}</span>` : a`${s === "icons" ? xe(d.label) : l}<span>${d.label}</span>`}</span
        >`;
  });
}
function fe(n, e, t = !1) {
  if (!n?.trim()) return l;
  const i = n.trim(), s = i.toUpperCase().replaceAll(" ", ""), r = {
    G: "general",
    PG: "parental",
    "PG-13": "teen",
    PG13: "teen",
    R: "restricted",
    "NC-17": "adult",
    NC17: "adult"
  }[s] ?? "unrated";
  return e ? a`<button
      type="button"
      class=${`rating-badge rating-${r}`}
      aria-label=${`Filter by rating: ${i}`}
      ?disabled=${t}
      @click=${() => e(i)}
    >
      ${i}
    </button>` : a`<span
    class=${`rating-badge rating-${r}`}
    title=${`Rating: ${i}`}
    >${i}</span
  >`;
}
function X(n) {
  const e = n.toLowerCase().replace(/[\s_-]+/g, "");
  return e === "played" ? "Watched" : e === "watchsoon" ? "Watch Soon" : n;
}
function wt(n) {
  const e = n.toLowerCase();
  return e.replace(/[\s_-]+/g, "") === "watchsoon" ? "watch-soon" : {
    all: "all",
    new: "new",
    "recently added": "new",
    unwatched: "unwatched",
    watched: "watched",
    played: "watched",
    favorites: "favorite",
    favorite: "favorite",
    paused: "progress",
    "in progress": "progress"
  }[e] ?? "all";
}
function xe(n) {
  const e = wt(n), t = {
    all: $`<path d="m2 7 10-5 10 5-10 5zM2 12l10 5 10-5M2 17l10 5 10-5"/>`,
    new: $`<path d="m12 1 3 2 4 1 1 4 3 4-3 3-1 4-4 1-3 3-3-3-4-1-1-4-3-3 3-4 1-4 4-1z"/><text x="12" y="14.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="6" font-weight="800">NEW</text>`,
    unwatched: $`<circle cx="12" cy="12" r="10"/><path fill="currentColor" stroke="none" d="m9 6 9 6-9 6z"/>`,
    watched: $`<circle cx="12" cy="12" r="10"/><path d="m6 12 4 4 8-8"/>`,
    favorite: $`<path d="M12 21 3 12C-3 4 6-1 12 6c6-7 15-2 9 6z"/>`,
    progress: $`<circle cx="12" cy="12" r="10"/><path d="M9 7v10M15 7v10"/>`,
    "watch-soon": $`<circle cx="12" cy="12" r="10"/><path d="M12 6v6h5"/>`
  };
  return $`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t[e]}</svg>`;
}
function le(n, e, t = !1, i) {
  const s = a`${xe(n)}<span
      >${X(n)}</span
    >`, r = `collection-badge collection-${wt(n)}${n.toLowerCase() === "recently added" ? " status-recent" : ""}`;
  return e ? a`<button
        type="button"
        class=${r}
        aria-label=${i ?? `Filter by collection: ${X(n)}`}
        ?disabled=${t}
        @click=${e}
      >
        ${s}
      </button>` : a`<span class=${r}>${s}</span>`;
}
const D = (n) => n.toLowerCase().replace(/[\s_-]+/g, ""), de = (n) => ({
  new: "Unwatched",
  played: "Watched",
  paused: "In Progress",
  watchsoon: "Watch Soon"
})[D(n)] ?? n, ce = (n) => ["queued", "working", "syncing"].includes(n.status), He = class He extends x {
  constructor() {
    super(...arguments), this.revision = 0, this.enabled = !1, this.blocked = !1, this.choices = [], this.jobs = [], this.generation = 0, this.selected = "", this.busy = !1, this.refreshing = !1, this.refreshNotice = "", this.error = "";
  }
  willUpdate(e) {
    (e.has("client") || e.has("scope") || e.has("version") && e.get("version")?.id !== this.version?.id || e.has("enabled") && !this.enabled) && this.clear();
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
    this.generation++, this.selected = "", this.busy = !1, this.refreshing = !1, this.refreshed = void 0, this.refreshNotice = "", this.pending = void 0, this.error = "", this.renderRoot.querySelector("dialog")?.close();
  }
  confirmNavigation() {
    return !this.busy && !this.pending;
  }
  close(e) {
    if (this.busy) {
      e?.preventDefault();
      return;
    }
    if (this.pending && !window.confirm(
      "This request may already be queued. Close and inspect the collection status before trying again?"
    )) {
      e?.preventDefault();
      return;
    }
    this.clear(), this.requestUpdate();
  }
  fail(e) {
    this.error = y(e), ["unauthorized", "library_disabled"].includes(g(e)) && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        g(e) === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    ));
  }
  async open() {
    if (!this.client || !this.scope || !this.version || !this.enabled || this.blocked)
      return;
    const e = ++this.generation;
    this.selected = "", this.error = "", this.requestUpdate(), await this.updateComplete, e === this.generation && this.isConnected && this.scope?.permissions.edit && this.renderRoot.querySelector("dialog")?.showModal();
  }
  get member() {
    return this.isMember(this.selected);
  }
  isMember(e) {
    return !!(this.refreshed?.collections ?? this.version?.collections)?.some(
      (t) => D(t) === D(e)
    );
  }
  get selectedKey() {
    return D(this.selected);
  }
  get queued() {
    return this.isQueued(this.selected);
  }
  isQueued(e) {
    const t = D(e);
    return this.jobs.some(
      (i) => ce(i) && i.title_id === this.version?.id && (D(i.collection) === t || ["new", "played"].includes(D(i.collection)) && ["new", "played"].includes(t))
    );
  }
  get actionLabel() {
    return this.actionFor(this.selected);
  }
  actionFor(e) {
    const t = D(e), i = this.isMember(e);
    return t === "new" ? i ? "Move to Watched" : "Move to Unwatched" : t === "played" ? i ? "Move to Unwatched" : "Move to Watched" : `${i ? "Remove from" : "Add to"} ${de(e)}`;
  }
  rowDisabled(e) {
    const t = D(e), i = this.isMember(e);
    return this.busy || this.refreshing || !!this.pending || this.isQueued(e) || this.jobs.filter(ce).length >= 10 || t === "paused" && !i || i && !["favorites", "watchsoon", "new", "played", "paused"].includes(
      t
    );
  }
  rowHint(e) {
    const t = D(e), i = this.isMember(e);
    return this.isQueued(e) ? "Change queued or being verified" : t === "paused" ? i ? "Can be removed; playback adds it again" : "Start playback to add In Progress" : ["new", "played"].includes(t) ? i ? "Currently in this status · moving changes both" : "Watched and Unwatched cannot overlap" : i && !["favorites", "watchsoon"].includes(t) ? "Custom collection removal is not yet supported" : i ? "Currently in this collection" : "Not in this collection";
  }
  get disabled() {
    return !this.selected || this.busy || this.refreshing || this.queued || this.jobs.filter(ce).length >= 10 || this.selectedKey === "paused" && !this.member || this.member && !["favorites", "watchsoon", "new", "played", "paused"].includes(
      this.selectedKey
    );
  }
  async submit() {
    if (!this.client || !this.scope || !this.version || this.disabled) return;
    try {
      this.pending ??= this.client.prepareCollectionChange(
        this.scope,
        this.version.id,
        this.selected,
        this.member ? "remove" : "add",
        this.refreshed?.revision ?? this.revision
      );
    } catch (t) {
      this.fail(t), this.requestUpdate();
      return;
    }
    const e = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      const t = await this.client.queueCollectionChange(this.pending);
      if (e !== this.generation) return;
      this.pending = void 0, this.busy = !1, this.clear(), this.dispatchEvent(
        new CustomEvent("collection-changed", {
          detail: t,
          bubbles: !0,
          composed: !0
        })
      );
    } catch (t) {
      e === this.generation && ([
        "invalid_request",
        "refresh_required",
        "busy",
        "conflict",
        "collection_uncertain",
        "collection_disabled"
      ].includes(g(t)) && (this.pending = void 0), this.fail(t));
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async refresh() {
    if (!this.client || !this.scope || !this.version || this.busy || this.refreshing || this.pending)
      return;
    const e = this.generation;
    this.refreshing = !0, this.error = "", this.refreshNotice = "", this.requestUpdate();
    try {
      const t = await this.client.refreshTitleCollections(
        this.scope,
        this.version.id,
        this.refreshed?.revision ?? this.revision
      );
      if (e !== this.generation) return;
      this.refreshed = t, this.refreshNotice = "Collection status refreshed from the server.", this.dispatchEvent(
        new CustomEvent("collection-refreshed", {
          detail: { ...t, title_id: this.version.id },
          bubbles: !0,
          composed: !0
        })
      );
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.refreshing = !1, this.requestUpdate());
    }
  }
  render() {
    return !this.scope?.permissions.edit || !this.version || !this.enabled ? l : a`${ze("Collection", "collection", this.blocked || this.busy, () => this.open(), "collection-button")}
      <dialog
        data-admin-dialog
        class="database-dialog"
        @click=${q}
        @cancel=${this.close}
        aria-labelledby="collection-add-title"
      >
        <div class="card-head">
          <h2 id="collection-add-title">Manage collections</h2>
          <div class="actions">
            ${ze("Refresh collections", "refresh", this.busy || this.refreshing || !!this.pending || this.jobs.some(ce), () => this.refresh(), "refresh-collections")}
            ${S((e) => this.close(e), this.busy)}
          </div>
        </div>
        <div class="collection-kicker">Selected version</div>
        <p>
          <strong>${this.version.title}</strong> ·
          ${this.version.year ?? "Year unknown"} ·
          ${this.version.formats?.join(", ") || this.version.edition || "Format unknown"}
        </p>
        <p class="collection-context">
          Choose a collection. Changes run in the background and are checked
          after the Library refreshes.
        </p>
        ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
        ${this.refreshing ? a`<p role="status">Refreshing this version’s collection status…</p>` : this.refreshNotice ? a`<p role="status">${this.refreshNotice}</p>` : l}
        ${this.pending ? a`<p class="warning">The queue response was not confirmed. Retry the same request to check safely, or close and inspect the Library status.</p>` : l}
        <div class="collection-list" aria-label="Available collections">
          ${[...this.choices].sort((e, t) => {
      const i = [
        "favorites",
        "watchsoon",
        "new",
        "played",
        "paused"
      ], s = (r) => {
        const o = i.indexOf(D(r));
        return o < 0 ? i.length : o;
      };
      return s(e) - s(t) || de(e).localeCompare(de(t));
    }).map(
      (e) => a`<div
                  class=${`collection-row${this.isMember(e) ? " member" : ""}${this.isQueued(e) ? " pending" : ""}`}
                >
                  <span class="collection-icon" aria-hidden="true"
                    >${xe(de(e))}</span
                  >
                  <span class="collection-copy"
                    ><strong>${de(e)}</strong
                    ><small>${this.rowHint(e)}</small></span
                  >
                  <button
                    type="button"
                    ?disabled=${this.rowDisabled(e)}
                    @click=${() => {
        this.selected = e, this.submit();
      }}
                  >
                    ${this.isQueued(e) ? "Updating…" : this.actionFor(e)}
                  </button>
                </div>`
    )}
        </div>
        ${this.jobs.filter(ce).length >= 10 ? a`<p class="warning">The queue holds up to 10 changes. Wait for an item to finish.</p>` : l}
        ${this.choices.length ? l : a`<p>No cached collection names are available. Run a Library sync first.</p>`}
        ${this.pending ? a`<div class="dialog-footer">
                <button
                  type="button"
                  class="primary"
                  ?disabled=${this.disabled}
                  @click=${this.submit}
                >
                  ${this.busy ? "Queueing…" : this.pending ? "Retry queue request" : this.selected ? this.actionLabel : "Choose a collection"}
                </button>
              </div>` : l}
      </dialog>`;
  }
};
He.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  version: { attribute: !1 },
  revision: { type: Number },
  enabled: { type: Boolean },
  blocked: { type: Boolean },
  choices: { attribute: !1 },
  jobs: { attribute: !1 }
}, He.styles = [
  E,
  xi,
  C`
      .collection-button {
        border-radius: 999px;
        padding: 9px;
        min-height: 44px;
        line-height: 20px;
      }
      .collection-context {
        color: var(--muted);
        font-size: 13px;
      }
      .collection-list {
        display: grid;
        gap: 10px;
        margin: 18px 0;
      }
      .collection-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--primary-background-color, #f5f7f6);
      }
      .collection-icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        border-radius: 12px;
        background: var(--surface);
        color: var(--accent);
      }
      .collection-icon svg {
        width: 21px;
        height: 21px;
      }
      .collection-copy {
        flex: 1;
        min-width: 0;
      }
      .collection-copy strong,
      .collection-copy small {
        display: block;
      }
      .collection-copy strong {
        font-size: 14px;
      }
      .collection-copy small {
        margin-top: 3px;
      }
      .collection-row button {
        border-radius: 999px;
        white-space: nowrap;
        font-size: 12px;
      }
      .collection-row.member {
        border-color: var(--accent);
      }
      .collection-row.pending {
        opacity: 0.65;
      }
      .collection-kicker {
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.09em;
        color: var(--accent);
      }
      @media (max-width: 480px) {
        .collection-row {
          flex-wrap: wrap;
        }
        .collection-row button {
          margin-left: 56px;
        }
      }
      @media (max-width: 600px) {
        .collection-button {
          padding-inline: 9px;
          font-size: 13px;
        }
      }
    `
];
let Mt = He;
customElements.get("kaleidescape-library-collection-add") || customElements.define(
  "kaleidescape-library-collection-add",
  Mt
);
function qs(n) {
  return `${n.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })} ${n.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
function Es(n) {
  const e = new Date(n.started_at), t = n.ended_at ?? n.completed_at, i = t ? new Date(t) : null;
  return n.status === "completed" && i !== null && i > e && e.toDateString() !== i.toDateString() ? [
    { label: "Started", date: e, datetime: n.started_at },
    { label: "Completed", date: i, datetime: t }
  ] : [
    {
      label: n.status === "completed" ? "Completed" : "Partial",
      date: e,
      datetime: n.started_at
    }
  ];
}
function Pa(n) {
  return Es(n).map(({ label: e, date: t }) => `${e}: ${qs(t)}`).join(" · ");
}
const _e = class _e extends x {
  constructor() {
    super(...arguments), this.titleId = "", this.editable = !1, this.unified = !1, this.bound = "", this.generation = 0, this.items = [], this.cursor = null, this.loading = !1, this.error = "", this.dialogReady = !1, this.detailRequest = 0, this.editChooser = !1;
  }
  updated() {
    this.toggleAttribute("hidden", !this.items.length && !this.error);
  }
  edit(e) {
    this.editChooser = !1, this.dispatchEvent(
      new CustomEvent("edit-journal", {
        detail: e.id,
        bubbles: !0,
        composed: !0
      })
    );
  }
  async chooseEdit(e) {
    if (e.preventDefault(), e.stopPropagation(), this.items.length === 1 && !this.cursor)
      return this.edit(this.items[0]);
    this.editChooser = !0, this.requestUpdate(), await this.updateComplete, this.renderRoot.querySelector(".journal-edit-chooser")?.showModal();
  }
  scopeKey() {
    return `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}:${this.scope?.revision}:${this.titleId}`;
  }
  willUpdate() {
    if (!this.isConnected) return;
    const e = this.scopeKey();
    e === this.bound && this.client === this.boundClient || (this.clear(), this.bound = e, this.boundClient = this.client, this.client && this.scope?.library_enabled && this.titleId && this.load(!1));
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.detailRequest++, this.items = [], this.cursor = null, this.loading = !1, this.error = "", this.dialogReady = !1, this.editChooser = !1;
  }
  async load(e) {
    if (!this.client || !this.scope || this.loading) return;
    const t = this.client, i = this.scope, s = this.titleId, r = this.generation, o = () => this.isConnected && r === this.generation && this.client === t && this.bound === this.scopeKey() && this.titleId === s;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      let d = e ? this.cursor : null;
      const c = /* @__PURE__ */ new Set();
      do {
        if (d) {
          if (c.has(d))
            throw new Error("Unable to continue viewing history.");
          c.add(d);
        }
        const h = await t.list(
          i,
          "",
          "",
          d ?? void 0,
          "completed_at",
          !0,
          !1,
          s
        );
        if (!o()) return;
        this.items = d ? [...this.items, ...h.items] : h.items, this.cursor = h.next_cursor, d = this.cursor, this.requestUpdate();
      } while (d && this.renderRoot.querySelector("details")?.open);
    } catch (d) {
      if (!o()) return;
      g(d) === "unauthorized" || g(d) === "library_disabled" ? (this.clear(), this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      )) : g(d) === "refresh_required" ? (this.items = [], this.cursor = null, this.error = "Viewing history changed. Refresh to see the latest entries.") : this.error = y(d);
    } finally {
      o() && (this.loading = !1, this.requestUpdate());
    }
  }
  async openViewing(e) {
    const t = this.generation, i = ++this.detailRequest;
    if (await Promise.resolve().then(() => Na), t !== this.generation || i !== this.detailRequest || !this.isConnected || (this.dialogReady = !0, this.requestUpdate(), await this.updateComplete, t !== this.generation || i !== this.detailRequest || !this.isConnected))
      return;
    const s = this.renderRoot.querySelector(
      "kaleidescape-journal-calendar"
    );
    s && (await s.updateComplete, t === this.generation && i === this.detailRequest && s.openViewing(e));
  }
  render() {
    return !this.items.length && !this.error ? l : a`
      ${this.items.length ? a`<details
              @toggle=${(e) => {
      e.currentTarget.open && this.cursor && !this.loading && this.load(!0);
    }}
            >
              <summary>
                Journal
                ${this.editable && this.scope?.permissions.edit ? a`<button type="button" class="link summary-edit" @click=${this.chooseEdit}>edit</button>` : l}
              </summary>
              <ul>
                ${this.items.map(
      (e, t) => a`<li>
                      ${t ? a`<hr class="viewing-separator" />` : l}
                      <div class="viewing">
                        <div class="viewing-dates">
                          ${Es(e).map(({ label: i, date: s, datetime: r }) => a`<time datetime=${r}>${i}: ${qs(s)}</time>`)}
                        </div>
                        ${this.unified ? l : a`<button
                                type="button"
                                class="link"
                                @click=${() => {
        this.openViewing(e);
      }}
                              >
                                Click to view
                              </button>`}
                      </div>
                    </li>`
    )}
              </ul>
              ${this.loading ? a`<p role="status">Loading viewings…</p>` : l}
            </details>` : l}
      ${this.error ? a`<p class="error" role="alert">${this.error} <button @click=${() => {
      this.load(!!this.cursor);
    }}>Retry viewing history</button></p>` : l}
      ${this.editChooser ? a`<dialog
              class="journal-edit-chooser"
              aria-label="Edit journal entry"
              @cancel=${() => {
      this.editChooser = !1, this.requestUpdate();
    }}
            >
              <h2>Edit journal entry</h2>
              <p>Choose a viewing to edit.</p>
              <ul>
                ${this.items.map((e) => a`<li><button type="button" class="link" @click=${() => this.edit(e)}>${Pa(e)}</button></li>`)}
              </ul>
              <button
                type="button"
                @click=${() => {
      this.editChooser = !1, this.requestUpdate();
    }}
              >
                Cancel
              </button>
            </dialog>` : l}
      ${this.dialogReady ? a`<kaleidescape-journal-calendar .client=${this.client} .scope=${this.scope} .detailsOnly=${!0}></kaleidescape-journal-calendar>` : l}
    `;
  }
};
_e.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  titleId: { type: String },
  editable: { type: Boolean },
  unified: { type: Boolean }
}, _e.styles = [
  E,
  C`
      :host {
        display: flow-root;
        font-size: 10.5px;
      }
      :host([hidden]) {
        display: none;
      }
      details {
        margin-top: 12px;
      }
      .viewing button {
        font-size: inherit;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
        font-size: 12px;
      }
      .summary-edit {
        display: none;
        margin-left: 0.5rem;
        font-size: inherit;
        min-height: 0;
        padding: 0;
        line-height: inherit;
      }
      details[open] .summary-edit {
        display: inline;
      }
      ul {
        padding: 0;
        list-style: none;
      }
      details ul {
        font-size: inherit;
      }
      li {
        padding: 0.5rem 0;
      }
      .viewing-separator {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 0 0 0.5rem;
      }
      .viewing {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .viewing-dates time {
        display: block;
      }
    `
];
let Bt = _e;
customElements.get("kaleidescape-library-journal") || customElements.define("kaleidescape-library-journal", Bt);
const Ua = [
  ["title", "Display title"],
  ["sort_title", "Sort title (blank uses display title)"],
  ["year", "Year"],
  ["rating", "Rating"],
  ["synopsis", "Synopsis"],
  ["actors", "Cast · billing order"],
  ["directors", "Directors"],
  ["writers", "Writers"],
  ["producers", "Producers"],
  ["studios", "Studios"],
  ["genres", "Genres"]
], Yi = [
  ["purchased_on", "Purchase date"],
  ["purchase_price", "Purchase price"],
  ["retail_price", "Retail price"]
], Ct = /* @__PURE__ */ new Set([
  "actors",
  "directors",
  "writers",
  "producers",
  "studios",
  "genres"
]), Xe = class Xe extends x {
  constructor() {
    super(...arguments), this.versionId = "", this.blocked = !1, this.purchaseOnly = !1, this.dateOnly = !1, this.optionsOnly = !1, this.draft = {}, this.busy = !1, this.opened = !1, this.restoring = !1, this.formatMode = "auto", this.formatBadges = [], this.error = "", this.generation = 0;
  }
  willUpdate(e) {
    (e.has("scope") || e.has("client") || e.has("versionId")) && this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.reset();
  }
  lock() {
    this.dispatchEvent(
      new CustomEvent("edit-lock", {
        detail: this.opened || this.busy || !!this.pending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  reset() {
    this.generation++, this.review = void 0, this.draft = {}, this.pending = void 0, this.busy = !1, this.opened = this.restoring = !1, this.formatMode = "auto", this.formatBadges = [], this.error = "", this.renderRoot.querySelector("dialog")?.close(), this.lock();
  }
  close() {
    this.confirmNavigation() && (this.reset(), this.requestUpdate());
  }
  confirmNavigation() {
    return this.busy || this.pending ? !1 : !this.opened || !this.review || !this.restoring && !Object.keys(this.patch()).length || window.confirm("Discard your unsaved Library changes?");
  }
  report(e) {
    this.error = y(e), g(e) === "unauthorized" && (this.reset(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async open() {
    if (!this.client || !this.scope?.permissions.edit || this.blocked) return;
    this.reset(), this.busy = !0, this.opened = !0, this.lock(), this.requestUpdate(), await this.updateComplete, this.renderRoot.querySelector("dialog").showModal();
    const e = this.generation;
    try {
      const t = await this.client.libraryEdit(this.scope, this.versionId);
      if (e !== this.generation) return;
      if (this.purchaseOnly && !this.dateOnly && !this.optionsOnly && t.has_invoices !== !1) {
        this.error = "Purchase records changed. Close and reopen the movie details to edit the receipt.";
        return;
      }
      this.review = t, this.formatMode = t.format_mode ?? "auto", this.formatBadges = Y.filter(
        (i) => t.format_badges?.includes(i)
      ), this.draft = Object.fromEntries(
        Object.entries(t.values).map(([i, s]) => [
          i,
          Array.isArray(s) ? s.join(`
`) : String(s ?? "")
        ])
      );
    } catch (t) {
      e === this.generation && this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.lock(), this.requestUpdate());
    }
  }
  fields() {
    return this.purchaseOnly ? this.optionsOnly ? [] : this.dateOnly ? Yi.filter(([e]) => e === "purchased_on") : Yi : Ua;
  }
  patch() {
    const e = {};
    for (const [i] of this.fields()) {
      const s = this.draft[i] ?? "", r = Ct.has(i) ? s.split(`
`).map((o) => o.trim()).filter(Boolean) : i === "year" ? s.trim() ? Number(s) : null : [
        "sort_title",
        "purchased_on",
        "purchase_price",
        "retail_price"
      ].includes(i) ? s.trim() || null : s;
      JSON.stringify(r) !== JSON.stringify(
        this.review.values[i] ?? (Ct.has(i) ? [] : [
          "sort_title",
          "year",
          "purchased_on",
          "purchase_price",
          "retail_price"
        ].includes(i) ? null : "")
      ) && (e[i] = r);
    }
    const t = this.draft.purchase_information_unavailable === "true";
    if (this.purchaseOnly && t !== !!this.review.values.purchase_information_unavailable && (e.purchase_information_unavailable = t), !this.purchaseOnly && this.review) {
      const i = Y.filter(
        (s) => this.review?.format_badges?.includes(s)
      );
      (this.formatMode !== (this.review.format_mode ?? "auto") || JSON.stringify(this.formatBadges) !== JSON.stringify(i)) && (e.format_override = this.formatMode === "custom" ? { mode: "custom", badges: this.formatBadges } : { mode: this.formatMode });
    }
    return e;
  }
  async save() {
    if (!this.client || !this.scope?.permissions.edit || !this.review || this.busy)
      return;
    const e = this.generation;
    try {
      if (this.pending ??= this.restoring ? this.client.prepareLibraryReset(
        this.scope,
        this.versionId,
        this.review.snapshot
      ) : this.client.prepareLibraryEdit(
        this.scope,
        this.versionId,
        this.review.snapshot,
        this.patch()
      ), this.busy = !0, this.error = "", this.lock(), this.requestUpdate(), await this.client.saveLibraryEdit(this.pending), e !== this.generation) return;
      this.pending = void 0, this.busy = !1, this.reset(), this.requestUpdate(), this.dispatchEvent(
        new CustomEvent("metadata-changed", { bubbles: !0, composed: !0 })
      );
    } catch (t) {
      if (e !== this.generation) return;
      [
        "invalid_request",
        "conflict",
        "refresh_required",
        "not_found",
        "backup_in_progress",
        "busy"
      ].includes(g(t)) && (this.pending = void 0), this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.lock(), this.requestUpdate());
    }
  }
  render() {
    return this.scope?.permissions.edit ? a`${this.purchaseOnly ? a`<button type="button" class="link purchase-edit-link" ?disabled=${this.blocked || this.busy || !!this.pending} @click=${this.open}>edit</button>` : ze("Edit details", "edit", this.blocked || this.busy || !!this.pending, () => this.open())}
      <dialog
        data-admin-dialog
        class="inset-dialog"
        aria-labelledby="library-edit-title"
        @click=${q}
        @cancel=${(e) => {
      e.preventDefault(), this.close();
    }}
      >
        <div class="card-head">
          <h2 id="library-edit-title">
            ${this.purchaseOnly ? "Edit purchase details" : "Edit Library details"}
          </h2>
          ${S(() => this.close())}
        </div>
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.busy ? a`<p role="status">${this.pending ? "Saving changes…" : "Loading details…"}</p>` : l}
        ${this.review && this.restoring ? a`<p class="warning">
                Restore the original scanned metadata for all versions? This
                removes provider metadata, downloaded poster/hero selections,
                manual display changes and sort titles. Purchases and viewings
                remain intact. Background scraping stays paused for this movie
                until you explicitly scrape and apply data again.
              </p>` : this.review ? a`<p class="muted">
                    ${this.purchaseOnly ? "Saved purchase details appear for the whole movie group." : a`Display details apply to ${k(this.review.version_count, "version")}; format badges apply only to the selected version. Changes survive scans. Source IDs, runtime, purchases and viewing records are protected. Enter one name per line for credits and genres.`}
                  </p>
                  <div class="edit-fields">
                    ${this.fields().map(
      ([e, t]) => a`<label
                          >${t}${Ct.has(e) || e === "synopsis" ? a`<textarea
                                  name=${e}
                                  .value=${this.draft[e] ?? ""}
                                  ?disabled=${!!this.pending || this.busy}
                                  @input=${(i) => {
        this.draft[e] = i.target.value, this.requestUpdate();
      }}
                                ></textarea>` : a`<input
                                  name=${e}
                                  type=${e === "year" ? "number" : e === "purchased_on" ? "date" : "text"}
                                  .value=${this.draft[e] ?? ""}
                                  ?disabled=${!!this.pending || this.busy}
                                  @input=${(i) => {
        this.draft[e] = i.target.value, this.requestUpdate();
      }}
                                />`}</label
                        >`
    )}
                    ${this.purchaseOnly ? l : a`<fieldset>
                            <legend>Format badges · selected version</legend>
                            <p class="muted">
                              Choose the badges shown for this version.
                              Automatic Store matches use compatible editions;
                              HD audio is never inferred from a higher-quality
                              listing.
                            </p>
                            <div class="format-options">
                              ${Y.map(
      (e) => a`<label>
                                    <input
                                      type="checkbox"
                                      name="format_badge"
                                      value=${e}
                                      .checked=${this.formatBadges.includes(e)}
                                      ?disabled=${!!this.pending || this.busy}
                                      @change=${(t) => {
        const i = t.target.checked;
        this.formatBadges = Y.filter(
          (s) => s === e ? i : this.formatBadges.includes(
            s
          )
        ), this.formatMode = "custom", this.requestUpdate();
      }}
                                    />
                                    ${F({ formats: [e] })}
                                  </label>`
    )}
                            </div>
                            <p class="muted">
                              Source:
                              ${this.formatMode === "original" ? "Server scan only" : this.formatMode === "custom" ? "Manual selection" : "Server scan and compatible Store data"}
                            </p>
                            <div class="actions">
                              <button
                                type="button"
                                ?disabled=${!!this.pending || this.busy}
                                @click=${() => {
      this.formatMode = "original", this.formatBadges = Y.filter(
        (e) => this.review?.scanned_format_badges?.includes(
          e
        )
      ), this.requestUpdate();
    }}
                              >
                                Restore server formats
                              </button>
                              <button
                                type="button"
                                ?disabled=${!!this.pending || this.busy}
                                @click=${() => {
      this.formatMode = "auto", this.formatBadges = Y.filter(
        (e) => this.review?.automatic_format_badges?.includes(
          e
        )
      ), this.requestUpdate();
    }}
                              >
                                Use automatic matches
                              </button>
                            </div>
                            <p class="muted">
                              Choose Save changes to apply the selected format
                              source.
                            </p>
                          </fieldset>`}
                    ${this.purchaseOnly ? a`
                            <label class="check"
                              ><input
                                name="purchase_information_unavailable"
                                type="checkbox"
                                .checked=${this.draft.purchase_information_unavailable === "true"}
                                ?disabled=${!!this.pending || this.busy}
                                @change=${(e) => {
      this.draft.purchase_information_unavailable = String(
        e.target.checked
      ), this.requestUpdate();
    }}
                              />Purchase information unavailable</label
                            >
                            <p class="muted">
                              These details appear for the movie group. The
                              unavailable option applies to the whole movie.
                            </p>
                          ` : l}
                  </div>` : l}
        <div class="dialog-footer">
          <button ?disabled=${this.busy || !!this.pending} @click=${this.close}>
            Cancel
          </button>
          ${this.review && !this.purchaseOnly && !this.restoring && !this.pending ? a`<button
                  class="danger"
                  ?disabled=${this.busy}
                  @click=${() => {
      this.restoring = !0, this.requestUpdate();
    }}
                >
                  Restore original metadata…
                </button>` : l}
          ${this.restoring && !this.pending ? a`<button
                  ?disabled=${this.busy}
                  @click=${() => {
      this.restoring = !1, this.requestUpdate();
    }}
                >
                  Keep metadata
                </button>` : l}
          ${this.error && !this.pending ? a`<button ?disabled=${this.busy} @click=${this.open}>Reload details</button>` : l}
          <button
            class=${this.restoring ? "danger" : "primary"}
            ?disabled=${this.busy || !this.review || !this.pending && !this.restoring && !Object.keys(this.patch()).length}
            @click=${this.save}
          >
            ${this.pending ? "Retry exact save" : this.restoring ? "Restore original metadata" : "Save changes"}
          </button>
        </div>
      </dialog>` : l;
  }
};
Xe.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  versionId: {},
  blocked: { type: Boolean },
  purchaseOnly: { type: Boolean },
  dateOnly: { type: Boolean },
  optionsOnly: { type: Boolean }
}, Xe.styles = [
  E,
  xi,
  C`
      :host {
        display: inline-block;
      }
      dialog {
        width: min(640px, calc(100% - 24px));
      }
      .purchase-edit-link {
        font-size: inherit;
      }
      .edit-fields {
        display: grid;
        gap: 16px;
        padding-block: 8px 16px;
      }
      textarea {
        min-height: 90px;
      }
      .format-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin: 10px 0;
      }
      .format-options label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .format-options .format-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border: 1px solid var(--line);
        border-radius: 4px;
        font-size: 12px;
      }
      .format-options .dolby-symbol,
      .format-options .hdr-symbol {
        width: 16px;
        height: 11px;
      }
    `
];
let It = Xe;
customElements.get("kaleidescape-title-edit") || customElements.define("kaleidescape-title-edit", It);
const Ot = [
  "purchased_on",
  "purchase_price",
  "retail_price",
  "order_id",
  "href"
];
function As(n, e, t = 0) {
  return Ls(n, e, t).values;
}
function Ls(n, e, t = 0) {
  const i = n[t], s = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  return { values: Object.fromEntries(
    Ot.map((d) => {
      if (i?.[d] != null) return [d, i[d]];
      const c = [
        ...new Set(
          n.map((u) => u[d]).filter((u) => u != null)
        )
      ];
      if (c.length > 1)
        return r.add(d), [d, null];
      if (c.length === 1)
        return s.add(d), [d, c[0]];
      const h = [
        ...new Set(
          e.map((u) => u[d]).filter((u) => u != null)
        )
      ];
      return h.length > 1 && r.add(d), [d, h[0] ?? null];
    })
  ), foreign: s, conflicts: r };
}
function Ta(n) {
  if (!(!n || n.includes("\\") || [...n].some((e) => e.charCodeAt(0) <= 32)) && !(!/^https?:\/\//i.test(n) && !/^\/?movie-store\//.test(n)))
    try {
      const e = new URL(n, "https://www.kaleidescape.com/");
      return !["www.kaleidescape.com", "store.kaleidescape.com"].includes(
        e.hostname
      ) || !["http:", "https:"].includes(e.protocol) || e.username || e.password || e.port || !e.pathname.startsWith("/movie-store/") ? void 0 : (e.protocol = "https:", e.href);
    } catch {
      return;
    }
}
const Da = {
  title: "Receipt title",
  purchased_on: "Purchase date",
  purchase_price: "Purchase price",
  retail_price: "Retail price",
  order_id: "Order ID",
  href: "Store link"
}, We = class We extends x {
  constructor() {
    super(...arguments), this.titleId = "", this.index = 0, this.draft = {}, this.unavailable = !1, this.busy = !1, this.error = "", this.stale = !1, this.generation = 0;
  }
  firstUpdated() {
    this.renderRoot.querySelector("dialog")?.showModal(), this.updateComplete.then(() => {
      this.isConnected && this.load();
    });
  }
  disconnectedCallback() {
    this.generation++, super.disconnectedCallback();
  }
  initial(e = this.index) {
    return this.review ? {
      ...As(this.review.records, this.review.manual, e),
      ...this.review.records[e] ? { title: this.review.records[e].title } : {}
    } : {};
  }
  resetDraft() {
    this.draft = Object.fromEntries(
      Object.entries(this.initial()).map(([e, t]) => [e, t ?? ""])
    );
  }
  changes() {
    const e = this.initial();
    return Object.fromEntries(
      Object.entries(this.draft).flatMap(([t, i]) => {
        const s = i.trim() || null;
        return s !== (e[t] ?? null) ? [[t, s]] : [];
      })
    );
  }
  confirmNavigation() {
    return this.busy || this.pending ? !1 : !this.review || this.unavailable === this.review.unavailable && !Object.keys(this.changes()).length || window.confirm("Discard your unsaved purchase changes?");
  }
  close(e) {
    e?.preventDefault(), this.confirmNavigation() && this.dispatchEvent(
      new CustomEvent("purchase-cancel", { bubbles: !0, composed: !0 })
    );
  }
  notifyBusy() {
    this.dispatchEvent(
      new CustomEvent("purchase-busy", {
        detail: this.busy || !!this.pending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  report(e) {
    this.error = y(e), g(e) === "unauthorized" && this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    );
  }
  async load() {
    if (!this.client || !this.scope || !this.scope.permissions.edit) return;
    const e = ++this.generation;
    this.busy = !0, this.notifyBusy(), this.error = "", this.requestUpdate();
    try {
      const t = await this.client.groupPurchaseEdit(
        this.scope,
        this.titleId
      );
      if (e !== this.generation) return;
      this.review = t, this.index = 0, this.unavailable = t.unavailable, this.stale = !1, this.resetDraft();
    } catch (t) {
      e === this.generation && this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.notifyBusy(), this.requestUpdate());
    }
  }
  selectReceipt(e) {
    const t = e.target, i = Number(t.value);
    if (Object.keys(this.changes()).length && !window.confirm("Discard changes to this purchase?")) {
      t.value = String(this.index);
      return;
    }
    this.index = i, this.resetDraft(), this.requestUpdate();
  }
  async save() {
    if (!this.client || !this.scope?.permissions.edit || !this.review || this.busy || this.stale)
      return;
    const e = this.unavailable ? {} : this.changes();
    if (!this.pending && !Object.keys(e).length && this.unavailable === this.review.unavailable) {
      this.close();
      return;
    }
    this.pending ??= this.client.prepareGroupPurchaseEdit(
      this.scope,
      this.titleId,
      this.review.snapshot,
      {
        receipt_id: this.review.records[this.index]?.id ?? null,
        fields: e,
        unavailable: this.unavailable
      }
    );
    const t = this.generation;
    this.busy = !0, this.error = "", this.notifyBusy(), this.requestUpdate();
    try {
      if (await this.client.saveGroupPurchaseEdit(this.pending), t !== this.generation) return;
      this.pending = void 0, this.dispatchEvent(
        new CustomEvent("purchase-complete", { bubbles: !0, composed: !0 })
      );
    } catch (i) {
      if (t !== this.generation) return;
      [
        "conflict",
        "refresh_required",
        "invalid_request",
        "not_found",
        "unauthorized",
        "busy",
        "backup_in_progress"
      ].includes(g(i)) && (this.pending = void 0, this.stale = ["conflict", "refresh_required", "not_found"].includes(
        g(i)
      )), this.report(i);
    } finally {
      t === this.generation && (this.busy = !1, this.notifyBusy(), this.requestUpdate());
    }
  }
  render() {
    const e = this.review?.records[this.index] ? ["title", ...Ot] : [...Ot], t = this.review ? Ls(this.review.records, this.review.manual, this.index) : void 0;
    return a`<dialog
      aria-labelledby="purchase-edit-title"
      @cancel=${this.close}
      @click=${q}
    >
      <div class="card-head">
        <h2 id="purchase-edit-title">Edit purchase details</h2>
        ${S((i) => this.close(i), this.busy || !!this.pending)}
      </div>
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      ${this.busy ? a`<p role="status">${this.pending ? "Saving purchase details…" : "Loading purchase details…"}</p>` : l}
      ${this.review ? a`
              <label class="check"
                ><input
                  name="purchase_information_unavailable"
                  type="checkbox"
                  .checked=${this.unavailable}
                  ?disabled=${this.busy || !!this.pending}
                  @change=${(i) => {
      this.unavailable = i.target.checked, this.requestUpdate();
    }}
                />Purchase information unavailable</label
              >
              ${this.unavailable ? l : a`
                      ${this.review.records.length > 1 ? a`<label
                                >Purchase record<select
                                  name="purchase_record"
                                  .value=${String(this.index)}
                                  ?disabled=${this.busy || !!this.pending}
                                  @change=${this.selectReceipt}
                                >
                                  ${this.review.records.map((i, s) => a`<option value=${s}>${i.purchased_on ?? "Date unknown"} · ${i.title}${i.order_id ? ` · ${i.order_id}` : ""}</option>`)}
                                </select></label
                              >
                              <p class="muted">
                                Separate receipts remain separate. Select the
                                purchase to edit.
                              </p>` : l}
                      <div class="purchase-fields">
                        ${e.map(
      (i) => a`<label
                              >${Da[i]}<input
                                name=${i}
                                type=${i === "purchased_on" ? "date" : "text"}
                                .value=${this.draft[i] ?? ""}
                                ?disabled=${this.busy || !!this.pending || !!t?.foreign.has(i)}
                                @input=${(s) => {
        this.draft[i] = s.target.value, this.requestUpdate();
      }}
                              />${t?.foreign.has(i) ? a`<small>Select the purchase record containing this value to edit it.</small>` : l}</label
                            >`
    )}
                      </div>
                      ${t?.conflicts.size ? a`<p class="warning">Some saved purchase values differ. Review the original records in Database.</p>` : l}
                    `}
            ` : l}
      <div class="dialog-footer">
        <button
          type="button"
          ?disabled=${this.busy || !!this.pending}
          @click=${this.close}
        >
          Cancel
        </button>
        ${this.stale ? a`<button
                type="button"
                @click=${() => {
      this.confirmNavigation() && this.load();
    }}
              >
                Reload details
              </button>` : l}
        ${this.review && !this.stale ? a`<button type="button" class="primary" ?disabled=${this.busy} @click=${this.save}>${this.pending ? "Retry exact save" : "Save changes"}</button>` : l}
      </div>
    </dialog>`;
  }
};
We.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  titleId: { type: String }
}, We.styles = [
  E,
  C`
      dialog {
        width: min(640px, calc(100% - 24px));
      }
      .purchase-fields {
        display: grid;
        gap: 14px;
        margin-block: 12px;
      }
    `
];
let Nt = We;
customElements.get("kaleidescape-group-purchase-edit") || customElements.define(
  "kaleidescape-group-purchase-edit",
  Nt
);
const ke = [
  "collection",
  "actor",
  "director",
  "rating",
  "genre",
  "year",
  "format",
  "status"
], Ft = [
  "missing_metadata_artwork",
  "missing_purchase_information"
], za = /* @__PURE__ */ new Set([
  "watched",
  "unwatched",
  "in_progress",
  "favorite",
  "watch_soon",
  "recently_added"
]);
function Gi() {
  return {
    query: "",
    missing_metadata_artwork: !1,
    missing_purchase_information: !1,
    recently_added: !1,
    ...Object.fromEntries(ke.map((n) => [n, []]))
  };
}
function Se(n = new URL(location.href)) {
  return /^\/kaleidescape-companion\/?$/.test(n.pathname) && n.searchParams.get("companion_page") === "library";
}
function je(n = new URL(location.href), e = !1) {
  if (!Se(n)) return null;
  const t = n.searchParams;
  if (!["filters", "query", ...ke, ...Ft].some((o) => t.has(`library_${o}`))) return null;
  const s = t.get("library_query") ?? "", r = {
    query: s.length <= 500 && !s.includes("\0") ? s : "",
    missing_metadata_artwork: t.get("library_missing_metadata_artwork") === "1",
    missing_purchase_information: e && t.get("library_missing_purchase_information") === "1",
    recently_added: !1
  };
  for (const o of ke) {
    const d = t.getAll(`library_${o}`);
    r[o] = d.length <= 100 ? [
      ...new Set(
        d.filter(
          (c) => c.length > 0 && c.length <= 500 && !c.includes("\0") && (o !== "status" || za.has(c))
        )
      )
    ] : [];
  }
  return r;
}
function ja(n) {
  const e = new URL(location.href);
  if (!Se(e)) return;
  const t = e.searchParams;
  for (const i of ["filters", "query", ...ke, ...Ft])
    t.delete(`library_${i}`);
  t.set("library_filters", "1"), typeof n.query == "string" && n.query && t.set("library_query", n.query);
  for (const i of ke) {
    const s = n[i];
    if (Array.isArray(s))
      for (const r of s) t.append(`library_${i}`, r);
  }
  for (const i of Ft)
    n[i] === !0 && t.set(`library_${i}`, "1");
  history.replaceState(history.state, "", e);
}
const he = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["rating", "Rating", "rating"],
  ["genre", "Genre", "genres"],
  ["year", "Year", "year"],
  ["format", "Viewing format", "format"]
], St = [
  ["name", "Title"],
  ["year", "Year"],
  ["collection", "Collection"],
  ["length", "Length"],
  ["watched", "Status"],
  ["added", "Added on"],
  ["random", "Random"]
], Zi = [
  ["show_titles", "Show titles on covers"],
  ["show_format", "Show format badges"],
  ["show_badges", "Show library badges"],
  ["show_rating", "Show rating badges"],
  ["show_library_cost", "Show total library cost in footer"]
], qt = [
  "watched",
  "unwatched",
  "in_progress",
  "favorite",
  "watch_soon",
  "recently_added"
], es = (n, e) => ({
  favorite: "Favorites",
  watch_soon: "Watch Soon",
  recently_added: "Recently Added"
})[n] ?? U(n, e), Me = (n) => {
  const e = n.toLowerCase().trim();
  return e.replace(/[\s_-]+/g, "") === "watchsoon" ? "watch_soon" : {
    new: "unwatched",
    played: "watched",
    paused: "in_progress",
    favorites: "favorite"
  }[e];
}, Re = (n) => n.toLowerCase().trim() === "all" || !!Me(n), Ee = (n) => ["new", "played", "paused"].includes(n.trim().toLowerCase());
function ts(n) {
  const e = Array.isArray(n.collection) ? n.collection : [], t = e.map(Me).filter((s) => !!s), i = Array.isArray(n.status) ? n.status : [];
  return {
    ...n,
    collection: e.filter((s) => !Re(s)),
    status: [.../* @__PURE__ */ new Set([...i, ...t])],
    genre: Array.isArray(n.genre) ? [
      ...new Set(
        n.genre.map(
          (s) => ["sci-fi", "sci fi", "science fiction"].includes(
            s.trim().toLowerCase()
          ) ? "Science Fiction" : s
        )
      )
    ] : []
  };
}
const Ke = class Ke extends x {
  constructor() {
    super(), this.dialogOnly = !1, this.advanced = !1, this.bound = "", this.generation = 0, this.listRequest = 0, this.statusRequest = 0, this.purchaseLoading = !1, this.purchaseReload = !1, this.purchaseError = "", this.purchaseDetailsOpen = !1, this.versionRequest = 0, this.versionsLoading = !1, this.versionsError = "", this.widths = [360, 90, 260, 150, 140, 210], this.collectionLocked = !1, this.controlLocked = !1, this.scrapeLocked = !1, this.artworkLocked = !1, this.editLocked = !1, this.purchaseRepairBusy = !1, this.purchaseManagerOpen = !1, this.castLimit = 8, this.checkingCollection = !1, this.collectionRecoveryNotice = "", this.filters = {
      query: "",
      sort: "name",
      descending: !1
    }, this.applied = { ...this.filters }, this.loading = !1, this.requesting = !1, this.error = "", this.notice = "", this.noticeSeverity = "info", this.dismissedPending = /* @__PURE__ */ new Set(), this.dismissedLibraryErrors = /* @__PURE__ */ new Set(), this.collectionToast = "", this.collectionToastSeverity = "progress", this.observedCollectionJobs = /* @__PURE__ */ new Set(), this.notifiedCollectionJobs = /* @__PURE__ */ new Set(), this.covers = new T(), this.fuzzySearch = !0, this.mode = "list", this.coverSize = 150, this.movieStatusLabels = "modern", this.libraryBadgeStyle = "icons", this.display = {
      show_titles: !0,
      show_format: !0,
      show_badges: !0,
      show_rating: !1,
      show_library_cost: !1
    }, this.entriesPerPage = 100, this.preferencesReady = !1, this.preferenceError = "", this.coverColumns = 1, this.gridWidth = 0, this.requestLimit = 50, this.requestedOffset = 0, this.draft = {}, this.facetSearch = "", this.visibility = () => {
      clearTimeout(this.timer), document.hidden ? (clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0) : (this.refreshStatus(), this.scheduleLayoutPage());
    }, this.locationChanged = () => {
      if (this.dashboard || this.dialogOnly || !this.preferencesReady || !Se())
        return;
      const e = ts(
        je(void 0, !!this.scope?.permissions.edit) ?? Gi()
      ), t = { ...this.applied, ...e };
      JSON.stringify(t) !== JSON.stringify(this.applied) && this.confirmNavigation() && (clearTimeout(this.searchTimer), this.applied = t, this.filters = structuredClone(this.applied), this.draft = {}, this.facetSearch = "", this.selected && this.closeDialog("title-dialog"), this.load());
    }, this.mobileQuery = "", Ce(this, () => !this.preferencesReady || this.preferences?.unsettled || this.searchPreferences?.unsettled || this.loading || this.detailsLocked || this.resize || this.renderRoot.querySelector("dialog[open]") ? !1 : (this.clear(), this.initializePreferences(), this.refreshStatus(), !0));
  }
  get detailsLocked() {
    return this.collectionLocked || this.controlLocked || this.scrapeLocked || this.artworkLocked || this.editLocked || this.purchaseManagerOpen;
  }
  confirmNavigation() {
    return this.controlLocked || this.collectionLocked || this.scrapeLocked || this.artworkLocked || this.checkingCollection || this.purchaseRepairBusy ? !1 : [
      ...this.renderRoot.querySelectorAll(
        "kaleidescape-title-edit"
      )
    ].every((e) => e.confirmNavigation()) && (this.renderRoot.querySelector("kaleidescape-group-purchase-edit")?.confirmNavigation() ?? !0);
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), window.addEventListener("location-changed", this.locationChanged), window.addEventListener("popstate", this.locationChanged), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), window.removeEventListener("location-changed", this.locationChanged), window.removeEventListener("popstate", this.locationChanged), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  willUpdate(e) {
    if (!this.isConnected) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if (this.boundClient !== this.client || this.bound !== t) {
      if (this.clear(), this.boundClient = this.client, this.bound = t, this.client && this.scope?.library_enabled)
        if (this.dialogOnly) {
          this.preferencesReady = !0;
          const i = this.generation;
          this.preferences = new O(
            this.client,
            this.scope,
            !1,
            (s) => {
              i === this.generation && s && g(s) === "unauthorized" && this.fail(s);
            }
          ), this.preferences.load().then((s) => {
            i === this.generation && (this.movieStatusLabels = s.movie_status_labels === "kaleidescape" ? "kaleidescape" : "modern", this.requestUpdate());
          }).catch((s) => {
            i === this.generation && g(s) === "unauthorized" && this.fail(s);
          }), this.openTitleId && this.openLinkedTitle(this.openTitleId);
        } else
          this.initializePreferences(), this.refreshStatus();
      return;
    }
    if (e.has("dashboard") && this.preferencesReady) {
      this.initializePreferences();
      return;
    }
    this.preferencesReady && (e.has("openCriterion") && this.openCriterion && this.fromDetails(this.openCriterion.key, this.openCriterion.value), e.has("openTitleId") && this.openTitleId && this.openLinkedTitle(this.openTitleId));
  }
  async initializePreferences() {
    if (!this.client || !this.scope) return;
    const e = this.generation;
    this.preferences = new O(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t && g(t) === "unauthorized" ? this.fail(t) : (this.preferenceError = t ? y(t) : "", this.requestUpdate()));
      }
    ), this.searchPreferences = new O(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t && g(t) === "unauthorized" ? this.fail(t) : (this.preferenceError = t ? y(t) : "", this.requestUpdate()));
      },
      "search"
    );
    try {
      const [t, i] = await Promise.all([
        this.preferences.load(),
        this.searchPreferences.load()
      ]);
      if (e !== this.generation) return;
      const s = this.dashboard ? {
        ...t,
        ...this.dashboard,
        view: this.dashboard.view,
        page_size: this.dashboard.page_size,
        query: "",
        sort: "name",
        descending: !1,
        ...Object.fromEntries(
          [...he.map(([o]) => o), "status"].map((o) => [
            o,
            []
          ])
        ),
        missing_metadata_artwork: !1,
        missing_purchase_information: !1,
        recently_added: !1
      } : t;
      this.dashboard && (this.preferences?.dispose(), this.preferences = void 0, this.searchPreferences?.dispose(), this.searchPreferences = void 0, this.coverColumns = this.dashboard.columns), this.fuzzySearch = i.fuzzy_search, this.mode = s.view, this.entriesPerPage = s.page_size, this.coverSize = s.cover_size, this.movieStatusLabels = s.movie_status_labels === "kaleidescape" ? "kaleidescape" : "modern", this.libraryBadgeStyle = s.library_badge_style === "text" ? "text" : "icons", this.castLimit = Number.isInteger(s.cast_limit) ? s.cast_limit : 8, this.display = Object.fromEntries(
        Zi.map(([o]) => [o, s[o]])
      ), this.scope?.permissions.edit && this.display.show_library_cost && this.loadPurchaseTotals(), this.widths = [...s.widths], this.applied = Object.fromEntries(
        [
          "query",
          "sort",
          "random_seed",
          "descending",
          ...he.map(([o]) => o),
          "status",
          "missing_metadata_artwork",
          "missing_purchase_information",
          "recently_added"
        ].map((o) => [o, s[o]])
      );
      const r = this.dashboard ? null : je(void 0, !!this.scope?.permissions.edit);
      this.applied = {
        ...this.applied,
        ...ts(r ?? Gi())
      }, this.scope?.permissions.edit || (this.applied.missing_purchase_information = !1), this.filters = structuredClone(this.applied), this.preferencesReady = !0, this.openCriterion ? this.fromDetails(this.openCriterion.key, this.openCriterion.value) : await this.load(), this.openTitleId && e === this.generation && this.openLinkedTitle(this.openTitleId);
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  saveFilters() {
    !this.dashboard && !this.dialogOnly && ja(this.applied);
  }
  finishColumnResize() {
    this.resize && (this.resize = void 0, this.preferences?.set({ widths: [...this.widths] }));
  }
  clear() {
    clearTimeout(this.collectionToastTimer), this.collectionToast = "", this.observedCollectionJobs.clear(), this.notifiedCollectionJobs.clear(), this.mobileQuery = "", this.purchaseTotals = void 0, this.purchaseLoading = !1, this.purchaseReload = !1, this.purchaseError = "", this.purchaseDetailsOpen = !1, this.purchaseManagerOpen && this.repairLock(!1), this.purchaseManagerOpen = !1, this.purchaseRepairBusy = !1;
    const e = this.renderRoot.querySelector(".purchase-details");
    e && (e.open = !1), clearTimeout(this.searchTimer), this.preferences?.dispose(), this.preferences = void 0, this.searchPreferences?.dispose(), this.searchPreferences = void 0, this.preferencesReady = !1, this.preferenceError = "", this.generation++, this.listRequest++, clearTimeout(this.timer), clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0, this.gridObserver?.disconnect(), this.gridObserver = void 0, this.grid = void 0, this.gridWidth = 0, this.coverColumns = 1, this.entriesPerPage = this.requestLimit = 100, this.requestedOffset = 0;
    for (const t of this.renderRoot.querySelectorAll("dialog"))
      t.close();
    this.covers.cache.dispose(), this.covers = new T(), this.fuzzySearch = !0, this.movieStatusLabels = "modern", this.libraryBadgeStyle = "icons", this.castLimit = 8, this.display = {
      show_titles: !0,
      show_format: !0,
      show_badges: !0,
      show_rating: !1,
      show_library_cost: !1
    }, this.draft = {}, this.facetSearch = "", this.page = this.info = this.selected = void 0, this.collectionLocked = this.checkingCollection = !1, this.collectionRecoveryNotice = "", this.clearVersions(), this.widths = [360, 90, 260, 150, 140, 210], this.resize = void 0, this.filters = { query: "", sort: "name", descending: !1 }, this.applied = { ...this.filters }, this.loading = this.requesting = !1, this.error = this.notice = "", this.dismissedPending.clear(), this.dismissedLibraryErrors.clear(), this.requestUpdate();
  }
  updated() {
    for (const [t, i] of [
      ["library_page_size", String(this.entriesPerPage)],
      ["library_sort", String(this.applied.sort)],
      ["library_badge_style", this.libraryBadgeStyle]
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
    return this.entriesPerPage === "all" ? 1e3 : this.mode === "list" || this.dashboard ? this.entriesPerPage : Math.max(
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
      this.dashboard?.columns ?? Math.min(1e3, Math.floor((e + 2) / (this.coverSize + 2)))
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
    const t = g(e);
    (t === "unauthorized" || t === "library_disabled") && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        t === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    )), this.error = y(e), this.dialogOnly && !this.selected && this.dispatchEvent(
      new CustomEvent("title-dialog-error", {
        detail: this.error,
        bubbles: !0,
        composed: !0
      })
    ), this.requestUpdate();
  }
  async load(e = 0, t = !1) {
    if (this.detailsLocked || !this.client || !this.scope?.library_enabled) return;
    this.saveFilters(), clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0;
    const i = this.generation, s = ++this.listRequest, r = this.pageSize;
    this.requestLimit = r, this.requestedOffset = e, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const o = this.entriesPerPage === "all" ? await this.client.libraryAll(
        this.scope,
        { ...this.applied, fuzzy: this.fuzzySearch },
        () => i === this.generation && s === this.listRequest
      ) : await this.client.libraryList(this.scope, {
        ...this.applied,
        fuzzy: this.fuzzySearch,
        grouped: !0,
        limit: r,
        offset: e,
        ...e && this.page && !t ? {
          revision: this.page.revision,
          ...this.page.preferences_key ? { preferences_key: this.page.preferences_key } : {}
        } : {}
      });
      if (i !== this.generation || s !== this.listRequest || r !== this.pageSize)
        return;
      if (e && !o.items.length && o.total) {
        this.load(0, t);
        return;
      }
      this.page = o, o.random_seed !== void 0 && this.applied.sort === "random" && (this.applied.random_seed = o.random_seed, this.filters.random_seed = o.random_seed), this.selected && (this.selected = o.items.find((d) => d.id === this.selected?.id) ?? (t ? this.selected : void 0), this.selected ? this.versions && (this.versions.revision !== o.revision || this.versions.preferences_key !== o.preferences_key) && this.loadVersions() : this.closeDialog("title-dialog"));
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
      if (this.scope.permissions.edit)
        for (const r of s.collection_jobs ?? [])
          ["queued", "working", "syncing"].includes(r.status) ? this.observedCollectionJobs.add(r.request_id) : this.observedCollectionJobs.has(r.request_id) && !this.notifiedCollectionJobs.has(r.request_id) && (this.notifiedCollectionJobs.add(r.request_id), this.collectionToastSeverity = r.status === "confirmed" ? "success" : r.status === "uncertain" || r.status === "interrupted" ? "warning" : "error", this.collectionToast = r.status === "confirmed" ? `${r.title}: collection change verified and Library refreshed.` : `${r.title}: ${r.status === "uncertain" ? "collection result is unconfirmed; review it below." : r.error === "scan_unconfirmed" ? "device change was verified, but Library sync needs review." : "collection change did not complete; review the status below."}`, clearTimeout(this.collectionToastTimer), this.collectionToastTimer = setTimeout(() => {
            this.collectionToast = "", this.requestUpdate();
          }, 1e4));
      this.info = this.scope.permissions.edit ? s : {
        title_count: s.title_count,
        group_count: s.group_count,
        status_counts: s.status_counts,
        collection_count: s.collection_count,
        name_count: s.name_count,
        revision: s.revision,
        preferences_key: s.preferences_key,
        last_synced_at: s.last_synced_at,
        collections_synced_at: s.collections_synced_at
      }, (this.display.show_library_cost || this.purchaseDetailsOpen) && this.loadPurchaseTotals(), this.page && (this.page.revision !== s.revision || this.page.preferences_key !== s.preferences_key) && !this.loading && (this.selected ? !this.detailsLocked && (this.versions?.revision !== s.revision || this.versions?.preferences_key !== s.preferences_key) && this.loadVersions() : this.load(this.page.offset, !0));
    } catch (s) {
      i = g(s) === "unauthorized", e === this.generation && t === this.statusRequest && this.fail(s);
    } finally {
      e === this.generation && t === this.statusRequest && this.isConnected && !i && !document.hidden && (this.timer = setTimeout(
        () => {
          this.refreshStatus();
        },
        (this.info?.collection_jobs ?? []).some(
          (s) => ["queued", "working", "syncing"].includes(s.status)
        ) ? 2e3 : this.info?.metadata?.running || this.info?.metadata?.active || this.info?.phase && this.info.phase !== "idle" ? 5e3 : 3e4
      ), this.requestUpdate());
    }
  }
  scraperSummary() {
    const e = this.info?.metadata;
    return e ? `Scrapers ${e.enabled === !1 ? "off" : e.running || e.active ? `running · ${e.processed}/${e.total}` : e.failed || e.error ? "error · check integration status" : "idle"} · ${e.cached_groups ?? 0} scraped` : "";
  }
  async sync() {
    if (!this.client || !this.scope?.permissions.edit || this.requesting)
      return;
    const e = this.generation;
    this.requesting = !0, this.error = this.notice = "", this.requestUpdate();
    try {
      if (await this.client.librarySync(this.scope), e !== this.generation) return;
      this.notice = "Library sync requested. Cached titles remain available while it runs.", this.noticeSeverity = "progress", this.refreshStatus();
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
    e === "library-search" && (this.mobileQuery = String(this.filters.query ?? "")), this.renderRoot.querySelector(`#${e}`)?.close(), e === "title-dialog" && (this.selected = void 0, this.clearVersions()), this.requestUpdate();
  }
  async openLinkedTitle(e) {
    if (!this.client || !this.scope?.library_enabled) return;
    const t = this.generation, i = ++this.versionRequest;
    try {
      const s = await this.client.libraryVersions(this.scope, e);
      if (t !== this.generation || i !== this.versionRequest)
        return;
      const r = s.items.find((o) => o.id === e) ?? s.items[0];
      if (!r) throw new Error("Library title is unavailable.");
      this.selected = r, this.versions = s, this.activeVersion = r, this.requestUpdate(), await this.openDialog("title-dialog"), this.dialogOnly && this.refreshStatus();
    } catch (s) {
      t === this.generation && i === this.versionRequest && this.fail(s);
    }
  }
  select(e) {
    this.clearVersions(), this.selected = e, this.openDialog("title-dialog"), this.loadVersions();
  }
  clearVersions() {
    this.controlLocked = this.collectionLocked = this.scrapeLocked = this.artworkLocked = this.editLocked = !1, this.versionRequest++, this.versions = void 0, this.activeVersion = void 0, this.versionsError = "", this.versionsLoading = !1;
  }
  async loadVersions(e = 0) {
    if (this.detailsLocked || !this.client || !this.scope || !this.selected) return;
    const t = this.generation, i = ++this.versionRequest, s = this.selected.id, r = this.activeVersion?.id;
    this.versionsLoading = !0, this.versionsError = "", this.requestUpdate();
    try {
      const o = await this.client.libraryVersions(
        this.scope,
        s,
        e,
        e ? this.versions?.revision : void 0
      );
      if (t !== this.generation || i !== this.versionRequest || this.selected?.id !== s)
        return;
      this.versions = o, this.activeVersion = o.items.find((d) => d.id === r) ?? o.items[0], this.activeVersion && (this.selected = { ...this.selected, title: this.activeVersion.title });
    } catch (o) {
      t === this.generation && i === this.versionRequest && (["unauthorized", "library_disabled"].includes(g(o)) ? this.fail(o) : g(o) === "refresh_required" && e ? this.loadVersions() : this.versionsError = y(o));
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
    if (this.detailsLocked || !this.versions?.items.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
      return;
    e.preventDefault();
    const t = this.versions.items, i = t.findIndex(
      (r) => r.id === this.activeVersion?.id
    ), s = e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : (i + (e.key === "ArrowLeft" ? -1 : 1) + t.length) % t.length;
    this.activeVersion = t[s], this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#version-${s}`)?.focus()
    );
  }
  sort(e) {
    let t = String(this.applied.random_seed ?? "");
    if (e === "random") {
      let i;
      try {
        i = ie().replaceAll("-", "");
      } catch (s) {
        this.fail(s);
        return;
      }
      t = i !== t ? i : (i[0] === "0" ? "1" : "0") + i.slice(1);
    }
    this.applied = {
      ...this.applied,
      sort: e,
      descending: e !== "random" && this.applied.sort === e ? !this.applied.descending : !1,
      random_seed: t
    }, this.preferences?.set({
      sort: this.applied.sort,
      descending: this.applied.descending,
      ...e === "random" ? { random_seed: t } : {}
    }), this.load();
  }
  openFilters() {
    this.draft = structuredClone(this.applied), this.facetSearch = "", this.openDialog("filter-dialog");
  }
  clearFilters() {
    clearTimeout(this.searchTimer), this.filters = {
      query: "",
      sort: this.applied.sort,
      descending: this.applied.descending,
      random_seed: this.applied.random_seed
    }, this.applied = { ...this.filters }, this.draft = {}, this.facetSearch = "", this.saveFilters(), this.load();
  }
  fromDetails(e, t) {
    if (this.detailsLocked || this.checkingCollection) return;
    const i = e === "collection" && t.toLowerCase().trim() === "all";
    if (e === "collection") {
      const s = Me(t);
      s && (e = "status", t = s);
    }
    if (!(e === "status" && !qt.includes(t))) {
      if (this.dialogOnly) {
        this.dispatchEvent(
          new CustomEvent("browse-library", {
            detail: { key: e, value: t },
            bubbles: !0,
            composed: !0
          })
        ), this.closeDialog("title-dialog");
        return;
      }
      if (i) {
        this.clearFilters(), this.closeDialog("title-dialog");
        return;
      }
      clearTimeout(this.searchTimer), this.filters = {
        query: e === "query" ? t : "",
        sort: this.applied.sort,
        descending: this.applied.descending,
        random_seed: this.applied.random_seed,
        ...e === "query" ? {} : { [e]: [t] }
      }, this.applied = structuredClone(this.filters), this.draft = {}, this.facetSearch = "", this.saveFilters(), this.closeDialog("title-dialog"), this.load(), this.updateComplete.then(
        () => this.renderRoot.querySelector('[name="library_query"]')?.focus()
      );
    }
  }
  detailLink(e, t, i = t) {
    return e === "collection" && t.toLowerCase().trim() === "all" ? a`${i}` : a`<button
      type="button"
      class="link detail-link"
      ?disabled=${this.detailsLocked || this.checkingCollection}
      @click=${() => this.fromDetails(e, e === "query" ? JSON.stringify(t) : t)}
    >
      ${i}
    </button>`;
  }
  async openSearch() {
    this.mobileQuery = String(this.filters.query ?? ""), await this.openDialog("library-search"), this.renderRoot.querySelector('[name="library_mobile_query"]')?.focus();
  }
  refreshCached() {
    this.load(), this.refreshStatus();
  }
  renderSearchDialog() {
    return a`<dialog
      id="library-search"
      class="library-options"
      aria-labelledby="library-search-title"
      @click=${q}
    >
      <div class="card-head">
        <h2 id="library-search-title">Search Library</h2>
        ${S(() => this.closeDialog("library-search"))}
      </div>
      <form
        @submit=${(e) => {
      e.preventDefault(), this.filters.query = this.mobileQuery, this.applySearch(), this.closeDialog("library-search");
    }}
      >
        <label
          >Title, actor or director<input
            type="search"
            name="library_mobile_query"
            maxlength="500"
            .value=${_i(this.mobileQuery)}
            @input=${(e) => {
      this.mobileQuery = e.target.value;
    }}
        /></label>
        <div class="dialog-footer">
          <button type="submit" class="primary">Search</button>
        </div>
      </form>
    </dialog>`;
  }
  applySearch() {
    clearTimeout(this.searchTimer), this.applied = { ...this.applied, query: this.filters.query }, this.load();
  }
  choices(e, t) {
    const i = e === "status" ? [...qt] : this.page?.facets[t] ?? [], s = [
      .../* @__PURE__ */ new Set([...i, ...this.draft[e] ?? []])
    ];
    if (e === "rating") {
      const r = {
        "NC-17": 8,
        "NR-R": 7,
        R: 7,
        "NR-PG-13": 6,
        "PG-13": 6,
        "NR-PG": 5,
        PG: 5,
        "NR-G": 1,
        G: 1
      };
      s.sort(
        (o, d) => (r[o.toUpperCase()] ?? 3) - (r[d.toUpperCase()] ?? 3) || o.localeCompare(d)
      );
    }
    return s.filter(
      (r) => (e !== "collection" || !Re(r)) && (e !== "status" || qt.includes(r)) && xs(
        e === "collection" ? X(r) : e === "status" ? es(r, this.movieStatusLabels) : r,
        this.facetSearch,
        this.fuzzySearch
      )
    );
  }
  cover(e, t = e.artwork_key) {
    return a`<kaleidescape-library-cover
      .client=${this.client}
      .scope=${this.scope}
      .queue=${this.covers}
      .artworkKey=${t}
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
      "Inspect the collection on the device first. Acknowledging does not undo a change or send another one; it allows a new request even if the previous change already applied. Continue?"
    ))
      return;
    const i = this.generation;
    this.checkingCollection = !0, this.collectionRecoveryNotice = "", this.error = "", this.requestUpdate();
    try {
      const s = await (t ? this.client.collectionAcknowledge(this.scope, e) : this.client.collectionCheck(this.scope, e));
      if (i !== this.generation) return;
      this.notice = s.status === "confirmed" ? "Collection membership confirmed on the device." : s.status === "abandoned" ? "Request acknowledged. Acknowledging did not send a device change." : "The requested membership is not confirmed. Inspect the device before acknowledging this request.", this.noticeSeverity = s.status === "confirmed" ? "success" : s.status === "abandoned" ? "info" : "warning", this.collectionRecoveryNotice = this.notice, this.load(), this.refreshStatus();
    } catch (s) {
      i === this.generation && (this.collectionRecoveryNotice = y(s), this.fail(s));
    } finally {
      i === this.generation && (this.checkingCollection = !1, this.requestUpdate());
    }
  }
  async dismissCollectionJob(e) {
    if (!this.client || !this.scope) return;
    const t = this.generation;
    try {
      await this.client.dismissCollectionJob(this.scope, e), t === this.generation && this.refreshStatus();
    } catch (i) {
      t === this.generation && this.fail(i);
    }
  }
  async loadPurchaseTotals(e = !1) {
    if (!this.client || !this.scope?.library_enabled || !this.scope.permissions.edit || !e && this.purchaseTotals && this.purchaseTotals.revision === this.info?.revision)
      return;
    if (this.purchaseLoading) {
      this.purchaseReload = !0;
      return;
    }
    const t = this.generation;
    this.purchaseLoading = !0, this.purchaseError = "", this.requestUpdate();
    try {
      const i = await this.client.libraryPurchaseTotals(this.scope);
      t === this.generation && (this.purchaseTotals = i);
    } catch (i) {
      if (t !== this.generation) return;
      this.purchaseTotals = void 0, this.purchaseError = y(i), ["unauthorized", "library_disabled"].includes(g(i)) && this.fail(i);
    } finally {
      t === this.generation && (this.purchaseLoading = !1, this.purchaseReload && (this.purchaseReload = !1, this.loadPurchaseTotals(!0)), this.requestUpdate());
    }
  }
  purchaseAmount(e) {
    return this.purchaseTotals ? this.purchaseTotals.purchase_count ? this.purchaseTotals.currencies.map((t) => t[e]).filter((t) => t !== null).join(" · ") || "Not available" : "No recorded purchases" : this.purchaseError ? "Unavailable" : "Loading…";
  }
  renderPurchaseDetails() {
    if (!this.scope?.permissions.edit) return l;
    const e = this.purchaseTotals;
    return a`<details
      class="purchase-details"
      @toggle=${(t) => {
      this.purchaseDetailsOpen = t.target.open, this.purchaseDetailsOpen && this.loadPurchaseTotals(!0);
    }}
    >
      <summary>Purchase details</summary>
      <p class="muted">
        Recorded purchases for this Library source include older orders and
        unavailable titles. Unlinked purchases are excluded until matched.
        Filters do not change these totals. Currencies are kept separate.
      </p>
      ${this.purchaseLoading ? a`<p role="status">Loading purchase totals…</p>` : l}
      ${this.purchaseError ? a`<p class="error" role="alert">${this.purchaseError} <button @click=${() => this.loadPurchaseTotals(!0)}>Retry purchase totals</button></p>` : l}
      ${e ? a`<dl class="purchase-summary">
                <dt>Total library cost</dt>
                <dd>${this.purchaseAmount("library_cost")}</dd>
                <dt>Total retail price</dt>
                <dd>${this.purchaseAmount("retail_price")}</dd>
                <dt>Savings</dt>
                <dd>${this.purchaseAmount("savings")}</dd>
                <dt>Unique transactions</dt>
                <dd>${e.unique_transactions}</dd>
              </dl>
              <p class="muted">
                ${k(e.purchase_count, "purchase record")}. Missing
                prices are excluded. Savings use records with both prices in the
                same currency.
              </p>
              ${e.missing_purchase_prices || e.missing_retail_prices ? a`<p class="muted">${k(e.missing_purchase_prices, "missing paid price")} · ${k(e.missing_retail_prices, "missing retail price")}.</p>` : l}
              ${e.unpaired_prices ? a`<p class="muted">${k(e.unpaired_prices, "purchase record")} excluded from savings because prices are missing or use different currencies.</p>` : l}
              ${e.missing_order_ids ? a`<p class="muted">${k(e.missing_order_ids, "purchase record")} without an order ID; not included in the transaction count.</p>` : l}
              ${e.duplicate_purchases ? a`<p class="muted">${k(e.duplicate_purchases, "duplicate purchase record")} counted only once.</p>` : l}` : l}
    </details>`;
  }
  renderOptionsDialog() {
    return a`<dialog
      id="library-options"
      class="database-dialog library-options"
      aria-labelledby="library-options-title"
      @click=${q}
    >
      <div class="card-head">
        <h2 id="library-options-title">Library options</h2>
        ${S(() => this.closeDialog("library-options"))}
      </div>
      <p class="muted">
        Changes save automatically for your HA user’s
        ${this.preferences?.profile} layout.
      </p>
      <div class="options-fields">
        <label class="mobile-sort-setting"
          >Sort by<select
            name="library_mobile_sort"
            .value=${String(this.applied.sort)}
            @change=${(e) => this.sort(e.target.value)}
          >
            ${St.map(([e, t]) => a`<option value=${e} ?selected=${e === this.applied.sort}>${t}</option>`)}
          </select></label
        >
        <label class="check"
          ><input
            type="checkbox"
            name="library_fuzzy_search"
            .checked=${this.fuzzySearch}
            @change=${(e) => {
      this.fuzzySearch = e.target.checked, clearTimeout(this.searchTimer), this.applied = { ...this.applied, query: this.filters.query }, this.searchPreferences?.set({ fuzzy_search: this.fuzzySearch }), this.load();
    }}
          />Fuzzy search</label
        ><small
          >Applies across all views for your HA user. Off matches literal text,
          ignoring case. On also tolerates small spelling mistakes and word
          order differences. Double quotes require an exact whole-word
          phrase.</small
        >
        <fieldset class="view-options">
          <legend>View type</legend>
          ${["list", "covers"].map((e) => a`<label class="check"><input type="radio" name="library_view" value=${e} .checked=${this.mode === e} @change=${() => this.setMode(e)} />${e === "list" ? "List" : "Cover"}</label>`)}
        </fieldset>
        <label
          >Library badge style<select
            name="library_badge_style"
            .value=${this.libraryBadgeStyle}
            @change=${(e) => {
      this.libraryBadgeStyle = e.target.value === "text" ? "text" : "icons", this.preferences?.set({
        library_badge_style: this.libraryBadgeStyle
      }), this.requestUpdate();
    }}
          >
            <option
              value="icons"
              ?selected=${this.libraryBadgeStyle === "icons"}
            >
              Icons
            </option>
            <option value="text" ?selected=${this.libraryBadgeStyle === "text"}>
              Text
            </option>
          </select></label
        >
        <label
          >Movie status labels<select
            name="movie_status_labels"
            .value=${this.movieStatusLabels}
            @change=${(e) => {
      this.movieStatusLabels = e.target.value === "kaleidescape" ? "kaleidescape" : "modern", this.preferences?.set({
        movie_status_labels: this.movieStatusLabels
      }), this.requestUpdate();
    }}
          >
            <option value="modern">Modern format</option>
            <option value="kaleidescape">Kaleidescape format</option>
          </select></label
        >
        <label
          >Visible cast members<input
            type="number"
            name="cast_limit"
            min="1"
            max="30"
            step="1"
            .value=${String(this.castLimit)}
            @change=${(e) => {
      const t = Number(e.target.value);
      Number.isInteger(t) && t >= 1 && t <= 30 && (this.castLimit = t, this.preferences?.set({ cast_limit: t }), this.requestUpdate());
    }} /></label
        ><small
          >Billing order, when available. The full cast remains under More
          credits.</small
        >
        <label
          >Entries per page<select
            name="library_page_size"
            .value=${String(this.entriesPerPage)}
            @change=${this.changePageSize}
          >
            ${[25, 100, 1e3, "all"].map((e) => a`<option value=${e} ?selected=${e === this.entriesPerPage}>${e === "all" ? "All" : e}</option>`)}
          </select></label
        >
        ${this.mode === "covers" ? a`<label
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
              /></label>` : l}
        ${Zi.filter(
      ([e]) => e !== "show_library_cost" || this.scope?.permissions.edit
    ).map(
      ([e, t]) => a`<label class="check"
              ><input
                type="checkbox"
                name=${e}
                .checked=${this.display[e]}
                @change=${(i) => {
        const s = i.target.checked;
        this.display = { ...this.display, [e]: s }, this.preferences?.set({ [e]: s }), e === "show_library_cost" && s && this.loadPurchaseTotals(), this.requestUpdate();
      }}
              />${t}</label
            >`
    )}
      </div>
      ${this.info ? a`<details>
              <summary>Library details</summary>
              <p>
                ${k(this.info.group_count, "movie")} ·
                ${k(this.info.title_count, "individual version")} ·
                ${k(this.info.collection_count, "collection")}.
              </p>
              <p>
                Catalog synced: ${this.date(this.info.last_synced_at)}<br />Collections
                synced: ${this.date(this.info.collections_synced_at)}
              </p>
              <p>
                Source “New”, “Played” and “Paused” map to Unwatched, Watched
                and In progress.
              </p>
            </details>` : l}
      ${this.renderPurchaseDetails()}
      <div class="dialog-footer">
        <button
          type="button"
          ?disabled=${this.loading}
          @click=${this.refreshCached}
        >
          Refresh cached data
        </button>
        ${this.scope?.permissions.edit ? a`<button type="button" ?disabled=${this.requesting || !!this.info?.phase && this.info.phase !== "idle"} @click=${this.sync}>Sync now</button>` : l}
      </div>
    </dialog>`;
  }
  renderFilterDialog() {
    return a`<dialog
      id="filter-dialog"
      @click=${q}
      class="database-dialog library-dialog"
      aria-labelledby="filters-title"
    >
      <div class="card-head">
        <h2 id="filters-title">Library filters</h2>
        ${S(() => this.closeDialog("filter-dialog"))}
      </div>
      <p>
        Match any checked value within a category and all selected categories.
      </p>
      <label
        >Find filter values<input
          name="facet_search"
          type="search"
          .value=${this.facetSearch}
          @input=${(e) => {
      this.facetSearch = e.target.value, this.requestUpdate();
    }}
      /></label>
      ${this.page?.truncated_facets.length ? a`<p class="muted">Each category shows up to 500 known names.</p>` : l}
      <label class="check"
        ><input
          name="missing_metadata_artwork"
          type="checkbox"
          .checked=${!!this.draft.missing_metadata_artwork}
          @change=${(e) => {
      this.draft.missing_metadata_artwork = e.target.checked, this.requestUpdate();
    }}
        />Missing metadata/artwork</label
      >
      ${this.scope?.permissions.edit ? a`<label class="check"
              ><input
                name="missing_purchase_information"
                type="checkbox"
                .checked=${!!this.draft.missing_purchase_information}
                @change=${(e) => {
      this.draft.missing_purchase_information = e.target.checked, this.requestUpdate();
    }}
              />Missing purchase information</label
            >` : l}
      <div class="facet-groups">
        ${[
      ["status", "Movie status", "status"],
      ...he.filter(([e]) => e !== "actor" && e !== "director")
    ].map(([e, t, i]) => {
      const s = this.draft[e] ?? [], r = this.choices(e, i);
      return e === "collection" && !(this.page?.facets[i] ?? []).some(
        (o) => !Re(o)
      ) && !s.some((o) => !Re(o)) ? l : a`<fieldset>
            <legend>${t}</legend>
            <div class="facet-options">
              ${r.length ? r.map(
        (o) => a`<label class="check"
                          ><input
                            type="checkbox"
                            name=${e}
                            .value=${o}
                            .checked=${s.includes(o)}
                            ?disabled=${s.length >= 100 && !s.includes(o)}
                            @change=${(d) => {
          const c = this.draft[e] ?? [];
          this.draft = {
            ...this.draft,
            [e]: d.target.checked ? [...c, o] : c.filter((h) => h !== o)
          }, this.requestUpdate();
        }}
                          />${e === "status" ? le(es(o, this.movieStatusLabels)) : e === "rating" ? fe(o) : e === "collection" ? le(o) : e === "format" && we({ formats: [o] }).length === 1 ? F({ formats: [o] }) : o}</label
                        >`
      ) : a`<p class="muted">No matching options</p>`}
            </div>
          </fieldset>`;
    })}
      </div>
      ${["actor", "director"].map((e) => {
      const t = this.draft[e] ?? [];
      return t.map(
        (i) => a`<button
              type="button"
              class="person-chip"
              aria-label=${`Remove ${i}`}
              @click=${() => {
          this.draft = {
            ...this.draft,
            [e]: t.filter((s) => s !== i)
          }, this.requestUpdate();
        }}
            >
              ${i} ×
            </button>`
      );
    })}
      <div class="actions dialog-footer">
        <button
          @click=${() => {
      this.draft = {}, this.requestUpdate();
    }}
        >
          Clear filters</button
        ><span class="grow"></span>
        <button
          class="primary"
          @click=${() => {
      const e = { ...this.applied };
      for (const t of [...he.map(([i]) => i), "status"])
        e[t] = this.draft[t] ?? [];
      e.missing_metadata_artwork = !!this.draft.missing_metadata_artwork, e.missing_purchase_information = !!this.draft.missing_purchase_information, e.recently_added = !1, this.applied = e, this.saveFilters(), this.closeDialog("filter-dialog"), this.load();
    }}
        >
          Apply filters
        </button>
      </div>
    </dialog>`;
  }
  renderCollectionAction(e) {
    return this.scope?.permissions.edit ? a`<kaleidescape-library-collection-add
        slot="collection"
        .client=${this.client}
        .scope=${this.scope}
        .version=${e}
        .revision=${this.versions?.revision ?? 0}
        .enabled=${!!this.info?.collection_add_enabled}
        .choices=${this.info?.collection_choices ?? []}
        .jobs=${this.info?.collection_jobs ?? []}
        .blocked=${this.controlLocked || this.scrapeLocked || this.artworkLocked || !!this.info?.pending_adds?.length}
        @collection-lock=${(t) => {
      t.detail !== this.collectionLocked && (this.collectionLocked = t.detail, this.requestUpdate());
    }}
        @collection-changed=${(t) => {
      this.collectionLocked = !1, this.observedCollectionJobs.add(t.detail.request_id), this.collectionToast = "Collection change queued.", this.collectionToastSeverity = "progress", clearTimeout(this.collectionToastTimer), this.collectionToastTimer = setTimeout(() => {
        this.collectionToast = "", this.requestUpdate();
      }, 5e3), this.refreshStatus();
    }}
      ></kaleidescape-library-collection-add>
      ${(this.info?.pending_adds ?? []).map(
      (t) => a`<div slot="collection" class="warning" role="status">
            Collection changes are paused while an earlier change for
            <strong>${t.title}</strong> is unconfirmed. Check membership
            without sending another change, or inspect the server and
            acknowledge it.
            ${this.collectionRecoveryNotice ? a`<p>${this.collectionRecoveryNotice}</p>` : l}
            <div class="actions">
              <button
                ?disabled=${this.checkingCollection}
                @click=${() => this.checkCollection(t.request_id)}
              >
                Check membership
              </button>
              <button
                ?disabled=${this.checkingCollection}
                @click=${() => this.checkCollection(t.request_id, !0)}
              >
                Acknowledge unconfirmed change
              </button>
            </div>
          </div>`
    )}` : l;
  }
  pendingCollection(e) {
    return this.info?.collection_jobs?.find(
      (t) => t.group_id === e.id && ["queued", "working", "syncing"].includes(t.status)
    );
  }
  pendingCollectionBadge(e) {
    const t = this.pendingCollection(e);
    if (!t) return l;
    const i = {
      new: "Unwatched",
      played: "Watched",
      paused: "In Progress",
      watchsoon: "Watch Soon"
    }[t.collection.toLowerCase().replace(/[\s_-]+/g, "")] ?? t.collection;
    return a`<span
      class="pending-collection-badge"
      role="status"
      aria-label=${`Collection change in progress: ${i}`}
      >${xe(i)}<span>${i}</span
      ><span class="collection-spinner" aria-hidden="true"></span
    ></span>`;
  }
  compactRuntime(e) {
    if (e == null) return "Runtime unknown";
    const t = Math.round(e / 60), i = Math.floor(t / 60);
    return i ? `${i}h ${t % 60}m` : `${t}m`;
  }
  warningMessage(e) {
    return this.scope?.permissions.edit ? [
      ...e.missing_metadata_artwork ? ["Missing metadata or artwork"] : [],
      ...e.scraper_conflict ? ["Scraper conflict: review a provider match"] : []
    ].join("; ") : "";
  }
  conflictIcon(e) {
    const t = this.warningMessage(e);
    return t ? a`<span
          class="scraper-conflict-icon"
          role="img"
          aria-label=${t}
          title=${t}
          >⚠</span
        >` : l;
  }
  renderScrapeAction(e) {
    return a`<kaleidescape-title-scrape
      slot="collection"
      .client=${this.client}
      .scope=${this.scope}
      .versionId=${e.id}
      .blocked=${this.controlLocked || this.collectionLocked || this.editLocked || this.scrapeLocked || this.artworkLocked}
      @scrape-status-changed=${() => {
      this.load(this.page?.offset ?? 0, !0);
    }}
      @scrape-lock=${(t) => {
      t.detail !== this.scrapeLocked && (this.scrapeLocked = t.detail, this.requestUpdate());
    }}
      @metadata-changed=${async () => {
      this.scrapeLocked = !1, this.versions = void 0, await this.load(this.page?.offset ?? 0, !0), await this.loadVersions(), this.refreshStatus();
    }}
      @collection-refreshed=${(t) => {
      const { title_id: i, collections: s, revision: r } = t.detail;
      this.versions && (this.versions = {
        ...this.versions,
        revision: r,
        items: this.versions.items.map(
          (o) => o.id === i ? { ...o, collections: s } : o
        )
      }, this.activeVersion?.id === i && (this.activeVersion = { ...this.activeVersion, collections: s })), this.load(this.page?.offset ?? 0, !0), this.refreshStatus();
    }}
    ></kaleidescape-title-scrape>`;
  }
  renderMovieJournal(e) {
    return a`<kaleidescape-library-journal
      class="movie-journal"
      .client=${this.client}
      .scope=${this.scope}
      .titleId=${e}
      .editable=${this.advanced && !!this.scope?.permissions.edit}
      .unified=${!0}
    ></kaleidescape-library-journal>`;
  }
  repairLock(e) {
    this.dispatchEvent(
      new CustomEvent("control-lock", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    );
  }
  async refreshPurchaseDetails() {
    const e = this.versions?.offset ?? 0;
    this.purchaseManagerOpen = !1, this.purchaseRepairBusy = !1, this.repairLock(!1), this.versions = void 0, this.requestUpdate(), await this.load(this.page?.offset ?? 0, !0), await this.loadVersions(e), this.refreshStatus();
  }
  renderMoviePurchases() {
    if (!this.advanced || !this.scope?.permissions.edit) return l;
    const e = this.versions?.group_purchase_details;
    return e ? a`<details class="movie-purchases">
      <summary>
        Purchase details
        <button
          type="button"
          class="link summary-edit"
          @click=${(t) => {
      t.preventDefault(), t.stopPropagation(), this.purchaseManagerOpen = !0, this.repairLock(!0), this.requestUpdate();
    }}
        >
          edit
        </button>
      </summary>
      ${e.unavailable ? a`<p>Purchase information unavailable.</p>` : (e.records.length || e.manual.length ? [e.records[0]] : []).map((t, i) => {
      const s = As(
        e.records,
        e.manual,
        i
      ), r = Ta(s.href);
      return a`<p>
                ${s.purchased_on ? this.date(s.purchased_on) : "Date not imported"}${t ? a` · ${t.title}` : l}<br />
                Paid: ${s.purchase_price ?? "Unknown"} · Retail:
                ${s.retail_price ?? "Unknown"}<br />
                Order: ${s.order_id ?? "Unknown"}
                ${r ? a`<br /><a href=${r} target="_blank" rel="noopener noreferrer">store link</a>` : l}
              </p>`;
    })}
      ${!e.unavailable && e.records.length > 1 ? a`<p class="muted">Multiple purchase records are saved for this movie.</p>` : l}
      ${!e.unavailable && !e.records.length && !e.manual.length ? a`<p>No purchase details saved.</p>` : l}
      ${e.truncated ? a`<p class="warning">Additional purchase details are available in Database.</p>` : l}
    </details>` : l;
  }
  renderTitleDialog() {
    const e = this.selected, t = this.activeVersion, i = (this.versions?.total ?? e?.version_count ?? 1) > 1, s = this.scope?.permissions.edit, r = this.detailsLocked || this.checkingCollection, o = e?.content_ratings ?? [
      ...new Set(
        [
          e?.rating,
          ...(this.versions?.items ?? []).map((c) => c.rating)
        ].filter((c) => !!c?.trim())
      )
    ], d = t && "backdrop_key" in t ? t.backdrop_key : t?.enrichment?.tmdb?.backdrop_key;
    return a`<dialog
        id="title-dialog"
        @cancel=${(c) => {
      c.preventDefault(), this.closeDialog("title-dialog");
    }}
        @click=${q}
        class=${`database-dialog library-dialog movie-dialog inset-dialog${d ? " has-backdrop" : ""}`}
        aria-labelledby="library-title"
        @close=${() => {
      this.selected = void 0, this.clearVersions(), this.controlLocked = !1, this.dialogOnly && this.dispatchEvent(
        new CustomEvent("title-dialog-closed", {
          bubbles: !0,
          composed: !0
        })
      ), this.requestUpdate();
    }}
      >
        ${e ? a`
                <div class="movie-close">
                  ${S(() => this.closeDialog("title-dialog"))}
                </div>
                <div class="movie-intro">
                  ${d && t ? a`<div class="movie-hero" aria-hidden="true">${this.cover(t, d)}</div>` : l}
                  <div class="movie-heading">
                    <h2 id="library-title">
                      ${this.detailLink("query", e.title)}
                    </h2>
                  </div>
                  <p class="movie-summary">
                    ${t?.year ?? e.year ? this.detailLink("year", String(t?.year ?? e.year)) : "Year unknown"}
                    ·
                    ${this.compactRuntime(t?.duration_seconds ?? e.duration_seconds)}
                    ${t?.genres.length ? a` · ${t.genres.map((c, h) => a`${h ? ", " : ""}${this.detailLink("genre", c)}`)}` : l}
                  </p>
                  <div class="detail-badges movie-heading-badges">
                    ${F(i ? e : t ?? e, !1, (c) => this.fromDetails("format", c), r)}
                    ${o.map((c) => fe(c, (h) => this.fromDetails("rating", h), r))}
                    ${Le(e).map(
      (c) => a`<button
                          class=${`movie-status collection-badge collection-${wt(U(c, this.movieStatusLabels))}`}
                          ?disabled=${r}
                          @click=${() => this.fromDetails("status", c)}
                        >
                          ${xe(U(c, this.movieStatusLabels))}
                          <span
                            >${U(c, this.movieStatusLabels)}</span
                          >
                        </button>`
    )}
                    ${e.is_recently_added ? le("Recently Added", () => this.fromDetails("status", "recently_added"), r, "Filter by movie status: Recently Added") : l}
                    ${e.is_favorite ? le("Favorites", () => this.fromDetails("status", "favorite"), r) : l}
                    ${e.collections.filter(
      (c) => !Ee(c) && Me(c) !== "favorite"
    ).map(
      (c) => le(
        c,
        () => this.fromDetails("collection", c),
        r,
        c.toLowerCase().trim() === "all" ? "Show all movies" : void 0
      )
    )}
                  </div>
                  ${t ? a`<kaleidescape-device-controls
                          .client=${this.client}
                          .scope=${this.scope}
                          .versionId=${t.id}
                          mode="movie"
                          @control-lock=${(c) => {
      c.detail !== this.controlLocked && (this.controlLocked = c.detail, this.requestUpdate());
    }}
                          >${this.renderCollectionAction(t)}${s ? a`<kaleidescape-title-edit
                                    slot="collection"
                                    .client=${this.client}
                                    .scope=${this.scope}
                                    .versionId=${t.id}
                                    .blocked=${this.controlLocked || this.collectionLocked || this.scrapeLocked || this.artworkLocked}
                                    @edit-lock=${(c) => {
      c.detail !== this.editLocked && (this.editLocked = c.detail, this.requestUpdate());
    }}
                                    @metadata-changed=${async () => {
      this.editLocked = !1, this.versions = void 0, await this.load(
        this.page?.offset ?? 0,
        !0
      ), await this.loadVersions(), this.refreshStatus();
    }}
                                  ></kaleidescape-title-edit>
                                  ${this.renderScrapeAction(t)}` : l}${ua(t)}</kaleidescape-device-controls
                        >` : l}
                  ${this.versionsLoading ? a`<p role="status">Loading individual versions…</p>` : l}
                  ${this.versionsError ? a`<p class="error" role="alert">
                            ${this.versionsError}
                          </p>
                          <button
                            @click=${async () => {
      await this.load(this.page?.offset ?? 0, !0), this.loadVersions();
    }}
                          >
                            Refresh title details
                          </button>` : l}
                  ${this.versions && this.versions.total > 1 ? a`
                          <div
                            class="page-tabs version-tabs"
                            role="tablist"
                            aria-label="Title versions"
                            @keydown=${this.versionKey}
                          >
                            ${this.versions.items.map(
      (c, h) => a`<button
                                  ?disabled=${this.detailsLocked}
                                  role="tab"
                                  id=${`version-${h}`}
                                  aria-controls="version-details"
                                  tabindex=${c.id === t?.id ? 0 : -1}
                                  aria-selected=${c.id === t?.id}
                                  @click=${() => {
        this.activeVersion = c, this.requestUpdate();
      }}
                                >
                                  Version ${this.versions.offset + h + 1}
                                </button>`
    )}
                          </div>
                          ${this.versions.total > 50 ? a`<div class="actions"><button ?disabled=${!this.versions.offset || this.versionsLoading || this.detailsLocked} @click=${() => this.loadVersions(Math.max(0, this.versions.offset - 50))}>Previous versions</button><button ?disabled=${!this.versions.has_more || this.versionsLoading || this.detailsLocked} @click=${() => this.loadVersions(this.versions.offset + 50)}>Next versions</button></div>` : l}
                        ` : l}
                </div>
                ${t ? a`<div
                        class="playback-layout movie-body"
                        id="version-details"
                        role=${(this.versions?.total ?? 1) > 1 ? "tabpanel" : "region"}
                        aria-label=${(this.versions?.total ?? 1) === 1 ? "Version details" : l}
                        aria-labelledby=${(this.versions?.total ?? 1) > 1 ? `version-${this.versions?.items.findIndex((c) => c.id === t.id) ?? 0}` : l}
                      >
                        <div class="movie-aside">
                          <div class="cover movie-poster">
                            ${this.cover(t)}
                          </div>
                          ${i ? a`<div class="detail-badges version-format-badges">${F(t, !1, (c) => this.fromDetails("format", c), r)}</div>` : l}
                          <details class="movie-record-details">
                            <summary>Library details</summary>
                            <p class="muted">
                              ${l}First
                              detected ${this.date(t.first_seen)}.
                            </p>
                            ${l}
                          </details>
                          ${this.renderMovieJournal(e.id)}
                          ${this.renderMoviePurchases()}
                        </div>
                        <div class="movie-description">
                          <h3>Synopsis</h3>
                          <p class="movie-synopsis">
                            ${t.synopsis || "No synopsis available."}
                          </p>
                          <hr />
                          <dl class="movie-credits">
                            ${[
      ["Directors", t.directors, "query"],
      [
        "Cast",
        t.actors.slice(0, this.castLimit),
        "query"
      ],
      ["Genres", t.genres, "genre"],
      [
        "Collections",
        t.collections.filter(
          (c) => !Ee(c)
        ),
        "collection"
      ]
    ].map(
      ([c, h, u]) => h.length ? a`<div>
                                    <dt>${c}</dt>
                                    <dd>
                                      ${h.map((p, m, w) => a`<span class="credit-name">${this.detailLink(u, p, (c === "Collections" ? X(p) : p) + (m < w.length - 1 ? "," : ""))}</span>${m < w.length - 1 ? " " : ""}`)}
                                    </dd>
                                  </div>` : l
    )}
                          </dl>
                          ${fa(t, (c, h) => this.detailLink("query", c, h), this.castLimit)}
                          ${l}
                        </div>
                      </div>` : l}
              ` : l}
      </dialog>
      ${this.purchaseManagerOpen && t && this.advanced && this.scope?.permissions.edit ? a`<kaleidescape-group-purchase-edit
              .client=${this.client}
              .scope=${this.scope}
              .titleId=${t.id}
              @purchase-cancel=${() => {
      this.purchaseManagerOpen = !1, this.repairLock(!1), this.requestUpdate();
    }}
              @purchase-busy=${(c) => {
      this.purchaseRepairBusy = c.detail;
    }}
              @purchase-complete=${() => {
      this.refreshPurchaseDetails();
    }}
              @access-denied=${() => this.fail(new v("unauthorized"))}
            ></kaleidescape-group-purchase-edit>` : l}`;
  }
  render() {
    if (this.dialogOnly)
      return a`${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}${this.renderTitleDialog()}`;
    if (!this.preferencesReady)
      return a`<p role="status">
          ${this.error || "Loading Library preferences…"}
        </p>
        ${this.error ? a`<button @click=${this.initializePreferences}>Retry Library</button>` : l}`;
    const e = this.page?.limit ?? this.requestLimit, t = this.loading || !!this.layoutTimer, i = this.page?.items ?? [], s = this.mode === "covers" && !this.dashboard && this.page?.has_more && i.length >= this.coverColumns ? i.slice(
      0,
      i.length - i.length % this.coverColumns
    ) : i, r = this.scope?.permissions.edit, o = [...he.map(([d]) => d), "status"].reduce(
      (d, c) => d + (this.applied[c]?.length ?? 0),
      +!!this.applied.missing_metadata_artwork + +!!this.applied.missing_purchase_information + +!!this.applied.recently_added
    );
    return a`<section
      class="library-page"
      @access-denied=${(d) => {
      d.stopPropagation(), this.fail(new v("unauthorized"));
    }}
    >
      <div class="library-notifications" aria-label="Library notifications">
        ${this.preferenceError ? a`<div
                class="warning library-notification notification-error"
                role="alert"
              >
                Library preferences could not be saved: ${this.preferenceError}
                <button
                  @click=${() => {
      this.preferences?.retry(), this.searchPreferences?.retry();
    }}
                >
                  Retry saving preferences
                </button>
              </div>` : l}
        ${r && this.info?.error && !this.dismissedLibraryErrors.has(this.info.error) ? a`<div
                class="warning library-notification notification-error"
                role="status"
              >
                ${y(new v(this.info.error))}<button
                  class="notification-close"
                  aria-label="Dismiss Library warning"
                  @click=${() => {
      this.dismissedLibraryErrors.add(this.info.error), this.requestUpdate();
    }}
                >
                  ${R("clear")}
                </button>
              </div>` : l}
        ${this.error ? a`<div
                class="error library-notification notification-error"
                role="alert"
              >
                ${this.error}<button @click=${() => this.load()}>
                  Refresh results</button
                ><button
                  class="notification-close"
                  aria-label="Dismiss error"
                  @click=${() => {
      this.error = "", this.requestUpdate();
    }}
                >
                  ${R("clear")}
                </button>
              </div>` : l}
        ${this.notice ? a`<div
                class=${`notice library-notification notification-${this.noticeSeverity}`}
                role="status"
              >
                ${this.notice}<button
                  class="notification-close"
                  aria-label="Dismiss notice"
                  @click=${() => {
      this.notice = "", this.requestUpdate();
    }}
                >
                  ${R("clear")}
                </button>
              </div>` : l}
        ${this.collectionToast ? a`<div
                class=${`collection-toast library-notification notification-${this.collectionToastSeverity}`}
                role="status"
              >
                ${this.collectionToast}<button
                  class="notification-close"
                  aria-label="Dismiss collection notification"
                  @click=${() => {
      this.collectionToast = "", this.requestUpdate();
    }}
                >
                  ${R("clear")}
                </button>
              </div>` : l}
        ${r ? (this.info?.collection_jobs ?? []).filter(
      (d) => ["failed", "interrupted"].includes(d.status) && d.error !== "acknowledged"
    ).slice(0, 3).map(
      (d) => a`<div
                      class=${`warning library-notification notification-${d.status === "failed" ? "error" : "warning"}`}
                      role="status"
                    >
                      ${d.title}:
                      ${d.error === "scan_unconfirmed" ? "The device change was verified, but the Library scan did not confirm it. Inspect the device and run Sync now." : d.error === "library_timeout" ? "The server took too long to respond. Check the Home Assistant logs and inspect the server before trying again." : `The collection change did not complete (${d.error ?? d.status}). Refresh and inspect before trying again.`}
                      <button
                        class="notification-close"
                        aria-label="Dismiss collection failure"
                        @click=${() => this.dismissCollectionJob(d.request_id)}
                      >
                        ${R("clear")}
                      </button>
                    </div>`
    ) : l}
        ${r ? (this.info?.pending_adds ?? []).filter((d) => !this.dismissedPending.has(d.request_id)).map(
      (d) => a`<div
                      class="warning library-notification notification-warning"
                      role="status"
                    >
                      Unconfirmed collection change:
                      <strong>${d.title}</strong> → ${d.collection}.
                      Checking never sends another change.
                      <button
                        class="notification-close"
                        aria-label="Dismiss unconfirmed change notice"
                        @click=${() => {
        this.dismissedPending.add(d.request_id), this.requestUpdate();
      }}
                      >
                        ${R("clear")}
                      </button>
                      <div class="actions">
                        <button
                          ?disabled=${this.checkingCollection}
                          @click=${() => this.checkCollection(d.request_id)}
                        >
                          Check membership</button
                        ><button
                          ?disabled=${this.checkingCollection}
                          @click=${() => this.checkCollection(d.request_id, !0)}
                        >
                          Acknowledge unconfirmed change
                        </button>
                      </div>
                    </div>`
    ) : l}
      </div>
      ${r && this.info?.phase && this.info.phase !== "idle" ? a`<p role="status">Syncing… ${this.info.processed ?? 0}/${this.info.total ?? "?"}</p>` : l}
      <section class="card library-results">
        <div
          class=${`library-toolbar${this.dashboard?.search_position === "bottom" ? " toolbar-bottom" : ""}`}
          ?hidden=${!!this.dashboard && this.dashboard.search_position === "off" && !this.dashboard.show_filters && !this.dashboard.show_sort}
        >
          <div
            class="mobile-library-tools"
            role="toolbar"
            aria-label="Library shortcuts"
          >
            <button
              type="button"
              aria-label="Search Library"
              title="Search Library"
              aria-haspopup="dialog"
              aria-controls="library-search"
              class=${this.applied.query ? "active-shortcut" : ""}
              ?hidden=${this.dashboard?.search_position === "off"}
              @click=${this.openSearch}
            >
              ${R("search")}
            </button>
            <button
              type="button"
              aria-label="Library filters"
              title="Filters"
              aria-haspopup="dialog"
              aria-controls="filter-dialog"
              class=${o ? "active-shortcut" : ""}
              ?hidden=${this.dashboard?.show_filters === !1}
              @click=${this.openFilters}
            >
              ${R("filter")}
            </button>
            <button
              type="button"
              aria-label="Clear search and filters"
              title="Clear search and filters"
              ?hidden=${this.dashboard?.show_filters === !1}
              ?disabled=${this.loading}
              @click=${this.clearFilters}
            >
              ${R("clear")}
            </button>
            <button
              type="button"
              aria-label=${this.applied.sort === "random" ? "Randomize Library" : this.applied.descending ? "Sort ascending" : "Sort descending"}
              title=${this.applied.sort === "random" ? "Randomize" : this.applied.descending ? "Sort ascending" : "Sort descending"}
              ?hidden=${this.dashboard?.show_sort === !1}
              @click=${() => this.sort(String(this.applied.sort))}
            >
              ${R(this.applied.sort === "random" ? "shuffle" : this.applied.descending ? "descending" : "ascending")}
            </button>
            <button
              type="button"
              aria-label="Library options"
              title="Options"
              aria-haspopup="dialog"
              aria-controls="library-options"
              ?hidden=${!!this.dashboard}
              @click=${() => this.openDialog("library-options")}
            >
              ${R("options")}
            </button>
          </div>
          <form
            class="desktop-library-search"
            ?hidden=${this.dashboard?.search_position === "off"}
            @submit=${(d) => {
      d.preventDefault(), this.applySearch();
    }}
          >
            <label
              >Search titles, actors or directors<input
                name="library_query"
                type="search"
                maxlength="500"
                .value=${_i(String(this.filters.query ?? ""))}
                @input=${(d) => {
      this.filters.query = d.target.value, clearTimeout(this.searchTimer), this.searchTimer = setTimeout(() => this.applySearch(), 300);
    }}
            /></label>
            <button type="submit" ?disabled=${this.loading}>Search</button>
          </form>
          <div class="library-tools">
            <button
              ?hidden=${this.dashboard?.show_filters === !1}
              @click=${this.openFilters}
            >
              Filters${o ? ` (${o})` : ""}
            </button>
            <button
              ?hidden=${this.dashboard?.show_filters === !1}
              ?disabled=${this.loading}
              @click=${this.clearFilters}
            >
              Clear Filter
            </button>
            <label ?hidden=${this.dashboard?.show_sort === !1}
              >Sort by<select
                name="library_sort"
                .value=${String(this.applied.sort)}
                @change=${(d) => this.sort(d.target.value)}
              >
                ${St.map(([d, c]) => a`<option value=${d}>${c}</option>`)}
              </select></label
            >
            <button
              ?hidden=${this.dashboard?.show_sort === !1}
              @click=${() => this.sort(String(this.applied.sort))}
            >
              ${this.applied.sort === "random" ? "Randomize" : this.applied.descending ? "Descending ↓" : "Ascending ↑"}
            </button>
          </div>
          <button
            aria-haspopup="dialog"
            ?hidden=${!!this.dashboard}
            aria-controls="library-options"
            class="desktop-library-options"
            @click=${() => this.openDialog("library-options")}
          >
            Options
          </button>
        </div>
        ${this.mode === "covers" ? a`<div
                class="cover-grid"
                style=${`--cover-size: ${this.coverSize}px; --cover-columns: ${this.coverColumns}`}
              >
                ${s.map(
      (d) => a`<button
                      class=${`cover-tile${this.display.show_titles ? " has-title" : ""}${this.display.show_rating && d.rating ? " has-rating" : ""}`}
                      title=${`${d.title}${d.year ? ` (${d.year})` : ""}${this.warningMessage(d) ? `; ${this.warningMessage(d)}` : ""}`}
                      aria-label=${`Details for ${d.title}${d.year ? ` (${d.year})` : ""}${this.warningMessage(d) ? `; ${this.warningMessage(d)}` : ""}`}
                      @click=${() => this.select(d)}
                    >
                      <div class="cover-image">${this.cover(d)}</div>
                      ${this.display.show_badges || this.pendingCollection(d) ? a`<div class=${`cover-flags${this.pendingCollection(d) ? " collection-pending" : ""}`}>${this.display.show_badges ? Ki(d, !0, ["unwatched"], this.movieStatusLabels, this.libraryBadgeStyle) : l}${this.pendingCollectionBadge(d)}</div>` : l}
                      ${this.display.show_format ? a`<div class="cover-formats">${F(d, !0)}</div>` : l}
                      ${this.display.show_rating ? a`<div class="cover-rating">${fe(d.rating)}</div>` : l}
                      ${this.conflictIcon(d)}
                      ${this.display.show_titles ? a`<span class="cover-caption">${d.title}${d.year ? ` (${d.year})` : ""}</span>` : l}
                    </button>`
    )}
              </div>` : a`<div class="table-wrap">
                <table
                  class="library-table"
                  style=${`--library-width: ${this.widths.reduce((d, c) => d + c, 0)}px`}
                >
                  <colgroup>
                    ${this.widths.map((d) => a`<col style=${`width: ${d}px`} />`)}
                  </colgroup>
                  <thead>
                    <tr>
                      ${St.filter(([d]) => d !== "random").map(
      ([d, c], h) => a`<th
                            aria-sort=${this.applied.sort === d ? this.applied.descending ? "descending" : "ascending" : "none"}
                          >
                            <button
                              class="sort-heading"
                              @click=${() => this.sort(d)}
                            >
                              <span>${c}</span
                              ><span class="sort-icon" aria-hidden="true"
                                >${this.applied.sort === d ? this.applied.descending ? "↓" : "↑" : "↕"}</span
                              >
                            </button>
                            <span
                              class="column-resize"
                              role="separator"
                              aria-label=${`Resize ${c} column`}
                              aria-orientation="vertical"
                              aria-valuemin="80"
                              aria-valuemax="800"
                              aria-valuenow=${this.widths[h]}
                              tabindex="0"
                              title="Drag or use Left/Right to resize; Home resets"
                              @keydown=${(u) => this.resizeColumn(u, h)}
                              @pointerdown=${(u) => {
        u.preventDefault(), this.resize = {
          index: h,
          start: u.clientX,
          width: this.widths[h]
        }, u.currentTarget.setPointerCapture(u.pointerId);
      }}
                              @pointermove=${(u) => {
        this.resize?.index === h && (this.widths[h] = Math.max(
          80,
          Math.min(
            800,
            this.resize.width + u.clientX - this.resize.start
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
      (d) => a`<tr>
                          <td>
                            <button
                              class="link"
                              @click=${() => this.select(d)}
                            >
                              ${d.title}
                            </button>
                            ${this.conflictIcon(d)}
                            <div
                              class=${`library-summary-line${this.pendingCollection(d) ? " collection-pending" : ""}`}
                              title=${this.format(d)}
                            >
                              ${this.display.show_badges ? Ki(d, !1, [], this.movieStatusLabels, this.libraryBadgeStyle) : l}
                              ${this.pendingCollectionBadge(d)}
                              ${this.display.show_format ? F(d) : l}
                              ${this.display.show_format && !we(d).length ? a`<small>${this.format(d)}</small>` : l}
                              ${(d.version_count ?? 1) > 1 ? a`<small>${k(d.version_count, "version")}</small>` : l}
                            </div>
                          </td>
                          <td title=${this.years(d)}>${this.years(d)}</td>
                          <td>
                            <span
                              class="collection-cell"
                              title=${d.collections.filter((c) => !Ee(c)).map(X).join(", ")}
                              >${d.collections.filter((c) => !Ee(c)).map(X).join(", ") || "—"}</span
                            >
                          </td>
                          <td>${this.runtime(d)}</td>
                          <td>
                            ${(Le(d).length ? Le(d) : [d.watched_status === "unknown" ? "unknown" : "none"]).map((c) => U(c, this.movieStatusLabels)).join(", ")}
                          </td>
                          <td
                            title=${d.purchased_on ? "Imported purchase date" : "First detected by Companion"}
                          >
                            ${this.date(d.purchased_on ?? d.first_seen)}
                          </td>
                        </tr>`
    )}
                  </tbody>
                </table>
              </div>`}
        ${this.page?.items.length ? l : a`<p class="empty" role="status">${this.loading ? "Loading library…" : "No cached titles match. Adjust your filters or wait for a library sync."}</p>`}
      </section>
      <footer
        class="library-footer"
        aria-label="Library status and navigation"
        ?hidden=${this.dashboard?.show_stats === !1 && !this.page?.offset && !this.page?.has_more}
      >
        <div
          class="footer-summary"
          role="status"
          ?hidden=${this.dashboard?.show_stats === !1}
        >
          <span>
            ${String(this.applied.query ?? "").trim() || o ? a`<strong class="match-count">Matches ${this.page?.total ?? 0}</strong> · ` : l}
            Total ${this.info?.group_count ?? 0} ·
            ${U("unwatched", this.movieStatusLabels)}
            ${this.info?.status_counts?.unwatched ?? 0} ·
            ${U("watched", this.movieStatusLabels)}
            ${this.info?.status_counts?.watched ?? 0} ·
            ${U("in_progress", this.movieStatusLabels)}
            ${this.info?.status_counts?.in_progress ?? 0}
          </span>
          ${r && this.info ? a`<span class="footer-admin">${k(this.info.collection_count, "collection")}${this.info.artwork_enabled ? ` · Artwork ${((this.info.artwork_bytes ?? 0) / 1048576).toFixed(1)} MiB` : ""}${this.display.show_library_cost ? ` · Library cost ${this.purchaseAmount("library_cost")}` : ""} · Synced ${this.date(this.info.last_synced_at)}</span>` : l}
          ${r && this.info?.metadata ? a`<span class="scraper-status footer-admin">${this.scraperSummary()}</span>` : l}
          ${r && (this.info?.collection_jobs ?? []).some((d) => ["queued", "working", "syncing"].includes(d.status)) ? a`<span class="collection-queue-status">Collection changes: ${this.info?.collection_jobs?.filter((d) => d.status === "queued").length ?? 0} queued · ${this.info?.collection_jobs?.filter((d) => ["working", "syncing"].includes(d.status)).length ?? 0} in progress</span>` : l}
        </div>
        <div
          class="footer-actions actions"
          ?hidden=${!this.page || !this.page.offset && !this.page.has_more}
        >
          ${this.page && (this.page.offset > 0 || this.page.has_more) ? a` <button
                    aria-label="First page"
                    ?disabled=${t || !this.page.offset}
                    @click=${() => this.load()}
                  >
                    <span class="paging-label">First</span
                    ><span class="paging-icon">${R("first")}</span>
                  </button>
                  <button
                    aria-label="Previous page"
                    ?disabled=${t || !this.page.offset}
                    @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - e))}
                  >
                    <span class="paging-label">Previous</span
                    ><span class="paging-icon">${R("previous")}</span>
                  </button>
                  <button
                    aria-label="Next page"
                    ?disabled=${t || !this.page.has_more}
                    @click=${() => this.load((this.page?.offset ?? 0) + e)}
                  >
                    <span class="paging-label">Next</span
                    ><span class="paging-icon">${R("next")}</span>
                  </button>` : l}
        </div>
      </footer>
      ${this.renderOptionsDialog()} ${this.renderFilterDialog()}
      ${this.renderSearchDialog()} ${this.renderTitleDialog()}
    </section>`;
  }
};
Ke.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  openTitleId: { attribute: !1 },
  openCriterion: { attribute: !1 },
  dashboard: { attribute: !1 },
  dialogOnly: { type: Boolean },
  advanced: { type: Boolean }
}, Ke.styles = [E, yt];
let Vt = Ke;
customElements.get("kaleidescape-library") || customElements.define("kaleidescape-library", Vt);
const Ma = {
  playing: "Playing",
  paused: "Paused",
  forward: "Scanning forward",
  reverse: "Scanning backward",
  stopped: "Stopped",
  none: "Stopped"
}, Ba = {
  content: "Main content",
  credits: "Credits",
  intermission: "Intermission",
  disc_menu: "Disc menu",
  none: "No active content"
}, Ye = class Ye extends x {
  constructor() {
    super(...arguments), this.playerId = "", this.compact = !1, this.showControls = !0, this.boundScope = "", this.generation = 0, this.player = null, this.loading = !1, this.denied = !1, this.error = "", this.image = "", this.imageKey = "", this.visibility = () => {
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
    if (!["client", "scope", "playerId"].some((i) => e.has(i)))
      return;
    const t = this.scope?.permissions.read ? `${this.scope.entry_id}:${this.scope.dataset_id}:${!!this.scope.permissions.edit}:${this.playerId}` : "";
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
      const { players: s } = await e.nowPlaying(
        t,
        this.playerId || void 0
      );
      if (i !== this.generation) return;
      this.player = s[0] ?? null;
      const r = this.player, o = r?.available && r.artwork_key && r.entity_id ? `${r.entity_id}:${r.content_key ?? r.raw_content_id ?? ""}:${r.artwork_key}` : "";
      if (o !== this.imageKey && (this.clearImage(), this.imageKey = o, this.requestUpdate(), o)) {
        const d = this.abort = new AbortController(), c = setTimeout(() => d.abort(), 5e3);
        try {
          const h = await e.artwork(
            r.entity_id,
            d.signal
          );
          i === this.generation && h && (this.image = URL.createObjectURL(h));
        } catch (h) {
          if (g(h) === "unauthorized") throw h;
        } finally {
          clearTimeout(c), this.abort === d && (this.abort = void 0);
        }
      }
    } catch (s) {
      if (i !== this.generation) return;
      this.player = null, this.clearImage(), this.denied = g(s) === "unauthorized", this.error = this.denied ? "Now Playing access is unavailable. Check your account and source permissions." : "Now Playing could not refresh. Check the connection or refresh again.";
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate(), !this.denied && this.isConnected && !document.hidden && (this.timer = setTimeout(() => {
        this.refresh();
      }, 5e3)));
    }
  }
  recordingStatus(e, t) {
    return e.recording_error ? "Recording needs attention. Check HA diagnostics." : e.recording_paused ? "Recording paused for backup." : e.available ? t && e.recording_exclusion === "below_minimum_runtime" ? `Not recording: runtime is below the minimum of ${k(e.minimum_runtime_minutes, "minute")}.` : t && e.recording_exclusion === "runtime_unknown" ? "Waiting for a known runtime before recording." : "Recording enabled." : "Recording waiting for source entities.";
  }
  render() {
    const e = this.player, t = e?.available && !["stopped", "none"].includes(e.play_status);
    return a`<section class="card now-playing" aria-label="Now Playing">
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
        ${this.error ? a`<p class="playback-message" role="alert">${this.error}</p>` : e ? a`<div class="playback-layout">
                  <div class="cover">
                    ${this.image ? a`<img
                            src=${this.image}
                            alt="Current movie cover"
                            @error=${() => {
      const i = this.imageKey;
      this.clearImage(), this.imageKey = i, this.requestUpdate();
    }}
                          />` : a`<span>No artwork available</span>`}
                  </div>
                  <div class="playback-detail">
                    <small>${e.name ?? "Configured player"}</small>
                    <h3>
                      ${e.available ? t ? e.title ?? "Unknown title" : "No movie playing" : "Player unavailable"}
                    </h3>
                    ${e.available ? a`<p>${Ma[e.play_status] ?? "Unknown playback state"} · ${Ba[e.location] ?? "Unknown location"}</p>` : l}
                    ${t && e.duration_seconds != null ? a`<p>Runtime · ${(e.duration_seconds / 60).toFixed(2)} min</p>` : l}
                    ${this.scope?.permissions.edit && t && e.session ? a`<p>
                              This session ·
                              ${(e.session.watched_seconds / 60).toFixed(2)}
                              min counted
                            </p>
                            <small
                              >Pauses and scans are excluded.
                              ${e.session.credits_confirmed ? "Credits confirmed; journal completion also requires the configured watch threshold." : "Credits not yet confirmed."}
                              ${e.session.gap_count ? a` ${k(e.session.gap_count, "timing gap")}.` : l}</small
                            >` : l}
                    ${this.scope?.permissions.edit && e.recording_paused !== void 0 ? a`<p role="status">
                            ${this.recordingStatus(e, !!t)}
                            ${e.buffered_observations ? a` ${k(e.buffered_observations, "update")} buffered.` : l}
                          </p>` : l}
                    <small
                      >Live snapshot refreshes about every 5 seconds while
                      visible.</small
                    >
                  </div>
                </div>` : a`<p class="playback-message" role="status">
                  ${this.loading ? "Loading playback…" : "Automatic tracking is off. Configure a player in the integration options to show Now Playing."}
                </p>`}
      </section>
      ${this.showControls ? a` <kaleidescape-device-controls
              .client=${this.client}
              .scope=${this.scope}
              .playerId=${this.playerId}
              @player-changed=${(i) => {
      this.playerId = i.detail;
    }}
            ></kaleidescape-device-controls>` : l}`;
  }
};
Ye.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  playerId: {},
  compact: { type: Boolean, reflect: !0 },
  showControls: { type: Boolean }
}, Ye.styles = [
  E,
  C`
      :host([compact]) .now-playing {
        min-height: 0;
        margin: 0;
      }
      :host([compact]) .playback-layout {
        padding: 12px;
        gap: 16px;
      }
      :host([compact]) .playback-detail h3 {
        font-size: clamp(22px, 3vw, 36px);
      }
      .now-playing {
        min-height: min(60dvh, 640px);
      }
      .playback-layout {
        grid-template-columns: minmax(160px, 30%) minmax(0, 1fr);
        align-items: center;
        gap: clamp(24px, 4vw, 64px);
        padding: 24px;
      }
      .cover {
        width: 100%;
        height: auto;
        aspect-ratio: 2 / 3;
        max-height: min(56dvh, 560px);
        background: var(--secondary-background-color, #222);
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .playback-detail h3 {
        font-size: clamp(28px, 4vw, 64px);
        line-height: 1.15;
        margin: 16px 0;
      }
      .playback-detail > p {
        font-size: clamp(16px, 1.6vw, 24px);
      }
      @media (max-width: 560px) {
        .now-playing {
          min-height: 0;
          margin-top: 12px;
        }
        .playback-layout {
          grid-template-columns: minmax(76px, 28%) minmax(0, 1fr);
          gap: 12px;
          padding: 12px;
        }
        .playback-detail h3 {
          font-size: clamp(21px, 5vw, 28px);
          margin-block: 8px;
        }
        .playback-detail > p {
          font-size: 14px;
        }
      }
      @media (max-height: 540px) {
        .now-playing {
          min-height: 0;
        }
        .cover {
          max-height: 52dvh;
        }
        .playback-layout {
          padding: 12px;
          gap: 20px;
        }
        .playback-detail h3 {
          font-size: 26px;
        }
      }
    `
];
let Qt = Ye;
customElements.get("kaleidescape-now-playing") || customElements.define("kaleidescape-now-playing", Qt);
const is = (n, e, t) => {
  const i = /* @__PURE__ */ new Map();
  for (let s = e; s <= t; s++) i.set(n[s], s);
  return i;
}, Ia = ks(class extends $s {
  constructor(n) {
    if (super(n), n.type !== J.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(n, e, t) {
    let i;
    t === void 0 ? t = e : e !== void 0 && (i = e);
    const s = [], r = [];
    let o = 0;
    for (const d of n) s[o] = i ? i(d, o) : o, r[o] = t(d, o), o++;
    return { values: r, keys: s };
  }
  render(n, e, t) {
    return this.dt(n, e, t).values;
  }
  update(n, [e, t, i]) {
    const s = xa(n), { values: r, keys: o } = this.dt(e, t, i);
    if (!Array.isArray(s)) return this.ut = o, r;
    const d = this.ut ??= [], c = [];
    let h, u, p = 0, m = s.length - 1, w = 0, A = r.length - 1;
    for (; p <= m && w <= A; ) if (s[p] === null) p++;
    else if (s[m] === null) m--;
    else if (d[p] === o[w]) c[w] = Q(s[p], r[w]), p++, w++;
    else if (d[m] === o[A]) c[A] = Q(s[m], r[A]), m--, A--;
    else if (d[p] === o[A]) c[A] = Q(s[p], r[A]), oe(n, c[A + 1], s[p]), p++, A--;
    else if (d[m] === o[w]) c[w] = Q(s[m], r[w]), oe(n, s[p], s[m]), m--, w++;
    else if (h === void 0 && (h = is(o, w, A), u = is(d, p, m)), h.has(d[p])) if (h.has(d[m])) {
      const L = u.get(o[w]), j = L !== void 0 ? s[L] : null;
      if (j === null) {
        const re = oe(n, s[p]);
        Q(re, r[w]), c[w] = re;
      } else c[w] = Q(j, r[w]), oe(n, s[p], j), s[L] = null;
      w++;
    } else $t(s[m]), m--;
    else $t(s[p]), p++;
    for (; w <= A; ) {
      const L = oe(n, c[A + 1]);
      Q(L, r[w]), c[w++] = L;
    }
    for (; p <= m; ) {
      const L = s[p++];
      L !== null && $t(L);
    }
    return this.ut = o, Cs(n, c), z;
  }
}), Oa = C`
  :host {
    display: block;
    min-width: 0;
    container: journal-calendar / inline-size;
  }
  .month-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 20px;
  }
  .month-bar h2 {
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    text-align: center;
    font-size: 20px;
  }
  .calendar-scroll {
    overflow-x: auto;
  }
  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    width: 100%;
    min-width: 0;
  }
  .weekday {
    text-align: center;
    padding: 8px;
    font-weight: 600;
    color: var(--muted);
  }
  .day {
    position: relative;
    padding: 5px;
    min-height: 0;
    height: var(--calendar-day-size);
    border-top: 1px solid var(--line);
    border-inline-end: 1px solid var(--line);
  }
  .day.other-month {
    opacity: 0.35;
  }
  .day time {
    position: absolute;
    inset-block-start: 5px;
    inset-inline-start: 5px;
    z-index: 2;
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--surface);
    pointer-events: none;
    font-size: 12px;
  }
  .day.today time {
    color: var(--accent);
    font-weight: 700;
  }
  .cover-stack {
    position: absolute;
    inset: 5px;
    inset-block-end: auto;
    aspect-ratio: 2 / 3;
    width: min(
      calc(100% - 10px),
      calc((var(--calendar-day-size) - 11px) * 2 / 3)
    );
    margin-inline: auto;
    isolation: isolate;
  }
  .poster {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    width: calc(100% / var(--spread));
    height: calc(100% / var(--spread));
    min-height: 0;
    transform: translate(calc(var(--index) * 15%), calc(var(--index) * 15%));
    z-index: var(--layer);
    padding: 0;
    border: 0;
    border-radius: 4px;
    box-shadow: 0 1px 5px #0008;
    overflow: hidden;
    transition: box-shadow 0.12s;
  }
  .poster-art {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .poster-start .poster-art {
    clip-path: polygon(0 0, 100% 0, 100% 67%, 0 100%);
  }
  .poster-completion .poster-art {
    clip-path: polygon(0 33%, 100% 0, 100% 100%, 0 100%);
  }
  .poster-start,
  .poster-completion {
    background: transparent;
    box-shadow: none;
  }
  .poster:hover,
  .poster:focus-visible {
    z-index: 1100;
    outline: 2px solid var(--accent);
    box-shadow: 0 2px 8px #000c;
  }
  kaleidescape-library-cover {
    width: 100%;
    height: 100%;
  }
  .poster-title {
    position: absolute;
    bottom: 0;
    inset-inline: 0;
    padding: 3px;
    font-size: 10px;
    background: #000b;
    color: white;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .calendar-dialog {
    width: min(760px, calc(100% - 32px));
  }
  .calendar-dialog .card-head {
    align-items: start;
    gap: 16px;
  }
  .calendar-dialog h2 {
    overflow-wrap: anywhere;
  }
  .movie-detail {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 20px;
    margin-top: 20px;
  }
  .movie-detail > kaleidescape-library-cover {
    height: 210px;
    border-radius: 6px;
  }
  .movie-detail p {
    overflow-wrap: anywhere;
  }
  @container journal-calendar (max-width: 560px) {
    .month-bar {
      gap: 6px;
      padding: 6px 8px;
    }
    .month-bar h2 {
      font-size: 16px;
    }
    .month-bar button {
      flex: none;
      padding: 8px;
      min-width: 40px;
    }
    .weekday {
      padding: 6px 2px;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  @media (max-width: 700px) {
    .month-bar {
      position: sticky;
      top: var(
        --calendar-sticky-top,
        max(
          var(--companion-sticky-top, 0px),
          var(--companion-viewport-top, 0px),
          env(safe-area-inset-top, 0px)
        )
      );
      z-index: 10;
      background: var(--surface);
    }
  }
  @media (max-width: 600px) {
    .month-grid {
      min-width: 0;
    }
    .weekday,
    .day {
      padding-inline: 3px;
    }
    .weekday {
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .movie-detail {
      display: flow-root;
      margin-top: 12px;
      font-size: 13px;
    }
    .movie-detail > div {
      display: contents;
    }
    .movie-detail > kaleidescape-library-cover {
      float: left;
      width: 100px;
      height: 150px;
      margin: 0 12px 10px 0;
    }
    .month-bar {
      gap: 6px;
      padding: 6px 8px;
    }
    .month-bar h2 {
      font-size: 16px;
    }
  }
  @media (max-width: 380px) {
    .movie-detail > kaleidescape-library-cover {
      width: 72px;
      height: 108px;
      margin-inline-end: 10px;
    }
  }
`;
let Jt = !0;
const Ht = /* @__PURE__ */ new Set();
function I() {
  return Jt;
}
function ss(n) {
  if (Jt !== n) {
    Jt = n;
    for (const e of Ht) e();
  }
}
function Ei(n) {
  return Ht.add(n), () => Ht.delete(n);
}
function W(n) {
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function Rs(n = location.search, e = /* @__PURE__ */ new Date()) {
  const t = new URLSearchParams(n).get("companion_month") ?? "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) {
    const [i, s] = t.split("-").map(Number);
    if (i >= 100 && i <= 9998) return new Date(i, s - 1, 1);
  }
  return new Date(e.getFullYear(), e.getMonth(), 1);
}
function Ps(n) {
  return [
    new Date(n.getFullYear(), n.getMonth(), 1).toISOString(),
    new Date(n.getFullYear(), n.getMonth() + 1, 1).toISOString()
  ];
}
function Us(n) {
  const e = W(new Date(n.started_at)), t = n.ended_at ?? n.completed_at, i = t ? W(new Date(t)) : e;
  return n.status === "completed" && i !== e && t && new Date(t) > new Date(n.started_at) ? [
    { day: e, phase: "start" },
    { day: i, phase: "completion" }
  ] : [{ day: e, phase: "single" }];
}
const Ge = class Ge extends x {
  constructor() {
    super(...arguments), this.query = "", this.status = "", this.fuzzy = !0, this.daySize = 180, this.fitScreen = !1, this.disabled = !1, this.editable = !1, this.rememberUrl = !0, this.detailsOnly = !1, this.preserveDetailOnClose = !1, this.libraryRequest = 0, this.fittedSize = 180, this.month = Rs(), this.items = [], this.loading = !1, this.error = "", this.generation = 0, this.signature = "", this.privacy = "", this.queue = new T(), this.selectedArtwork = null, this.movie = null, this.detailRequest = 0, this.detailLoading = !1, this.detailError = "", this.scheduleLayout = () => {
      !this.fitScreen || !this.isConnected || this.layoutFrame !== void 0 || (this.layoutFrame = requestAnimationFrame(() => {
        if (this.layoutFrame = void 0, !this.fitScreen || !this.isConnected) return;
        const e = window.visualViewport?.height ?? window.innerHeight, t = Math.max(
          0,
          this.getBoundingClientRect().top,
          this.previousElementSibling?.getBoundingClientRect().bottom ?? 0
        ), i = this.closest("main"), s = [".month-bar", ".weekday"].reduce(
          (h, u) => h + (this.renderRoot.querySelector(u)?.getBoundingClientRect().height ?? 0),
          0
        ) + (this.nextElementSibling?.getBoundingClientRect().height ?? 0) + (i && parseFloat(getComputedStyle(i).paddingBottom) || 0) + 16, r = new Date(
          this.month.getFullYear(),
          this.month.getMonth(),
          1
        ), o = new Date(
          this.month.getFullYear(),
          this.month.getMonth() + 1,
          0
        ).getDate(), d = Math.ceil((r.getDay() + o) / 7), c = Math.max(48, Math.floor((e - t - s) / d));
        c !== this.fittedSize && (this.fittedSize = c, this.requestUpdate());
      }));
    };
  }
  connectedCallback() {
    super.connectedCallback(), this.unwatchMovieDialog = Ei(() => {
      if (this.requestUpdate(), !(this.detailsOnly || !this.selected)) {
        if (I() && this.renderRoot.querySelector(".calendar-dialog")?.open)
          this.openLibraryTitle(!0);
        else if (!I() && this.linkedTitleId) {
          const e = this.selected;
          this.linkedTitleId = void 0, this.openViewing(e);
        }
      }
    }), !this.detailsOnly && (window.addEventListener("resize", this.scheduleLayout), window.visualViewport?.addEventListener("resize", this.scheduleLayout), this.rememberMonth(), this.requestUpdate());
  }
  updated() {
    !this.isConnected || this.detailsOnly || (this.resizeObserver || (this.resizeObserver = new ResizeObserver(this.scheduleLayout), this.resizeObserver.observe(this), this.previousElementSibling && this.resizeObserver.observe(this.previousElementSibling), this.nextElementSibling && this.resizeObserver.observe(this.nextElementSibling)), this.scheduleLayout());
  }
  willUpdate() {
    if (!this.isConnected) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if ((e !== this.privacy || this.client !== this.boundClient) && (this.clear(), this.privacy = e, this.boundClient = this.client), this.detailsOnly) return;
    const t = JSON.stringify([
      e,
      this.scope?.revision,
      this.query,
      this.status,
      this.fuzzy,
      this.libraryTitleId,
      this.month.getTime()
    ]);
    t !== this.signature && (this.signature = t, this.load());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.unwatchMovieDialog?.(), this.unwatchMovieDialog = void 0, window.removeEventListener("resize", this.scheduleLayout), window.visualViewport?.removeEventListener("resize", this.scheduleLayout), this.resizeObserver?.disconnect(), this.resizeObserver = void 0, this.layoutFrame !== void 0 && cancelAnimationFrame(this.layoutFrame), this.layoutFrame = void 0, this.clear(), this.signature = this.privacy = "", this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.closeDetails(), this.items = [], this.error = "", this.loading = !1, this.queue.cache.dispose(), this.queue = new T();
  }
  fail(e) {
    g(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = y(e), this.requestUpdate();
  }
  async load() {
    if (!this.client || !this.scope) return;
    const e = ++this.generation;
    this.closeDetails(), this.items = [], this.totals = void 0, this.loading = !0, this.error = "", this.notifyStatus(), this.requestUpdate();
    try {
      const [t, i] = Ps(this.month), s = await this.client.calendarMonth(
        this.scope,
        t,
        i,
        this.query,
        this.status,
        this.fuzzy,
        this.libraryTitleId
      );
      e === this.generation && (this.items = s.items, this.totals = s.summary);
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.loading = !1, this.notifyStatus(), this.requestUpdate());
    }
  }
  /** Footer status is owned by the enclosing Journal, not a second calendar bar. */
  notifyStatus() {
    if (!this.isConnected) return;
    const e = {
      month: this.month.toLocaleDateString(void 0, {
        month: "long",
        year: "numeric"
      }),
      count: this.totals?.viewing_count,
      watchedSeconds: this.totals?.watched_seconds,
      loading: this.loading,
      error: this.error,
      empty: !this.items.length
    };
    this.dispatchEvent(
      new CustomEvent("calendar-status", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    );
  }
  refresh() {
    return this.load();
  }
  move(e) {
    this.month = new Date(
      this.month.getFullYear(),
      this.month.getMonth() + e,
      1
    ), this.rememberMonth(), this.requestUpdate();
  }
  today() {
    const e = /* @__PURE__ */ new Date();
    this.month = new Date(e.getFullYear(), e.getMonth(), 1), this.rememberMonth(), this.requestUpdate();
  }
  rememberMonth() {
    if (!this.rememberUrl) return;
    const e = new URL(location.href);
    e.searchParams.set(
      "companion_month",
      `${String(this.month.getFullYear()).padStart(4, "0")}-${String(this.month.getMonth() + 1).padStart(2, "0")}`
    ), history.replaceState(history.state, "", e);
  }
  closeDetails() {
    this.libraryRequest++, this.linkedTitleId = void 0, this.detailRequest++, this.selected = void 0, this.movie = null, this.selectedArtwork = null, this.detailLoading = !1, this.detailError = "", this.renderRoot.querySelector("dialog")?.close();
  }
  async openViewing(e, t = null) {
    if (!this.client || !this.scope) return;
    const i = this.generation, s = ++this.detailRequest;
    if (this.selected = e, this.selectedArtwork = t, this.movie = null, this.detailLoading = !0, this.detailError = "", this.requestUpdate(), await this.updateComplete, !(i !== this.generation || s !== this.detailRequest || !this.isConnected)) {
      if (I() && !this.detailsOnly && this.scope.library_enabled)
        try {
          const r = await this.client.viewingLibrary(this.scope, e.id);
          if (i !== this.generation || s !== this.detailRequest || !this.isConnected)
            return;
          if (r.library && I()) {
            this.linkedTitleId = r.library.title_id, this.detailLoading = !1, this.requestUpdate();
            return;
          }
        } catch (r) {
          if (i !== this.generation || s !== this.detailRequest)
            return;
          if (g(r) === "unauthorized") {
            this.fail(r);
            return;
          }
          this.detailError = y(r);
        }
      this.renderRoot.querySelector("dialog")?.showModal();
      try {
        const r = await this.client.calendarDetails(this.scope, e.id);
        i === this.generation && s === this.detailRequest && (this.selected = r.viewing, this.movie = r.movie, this.selectedArtwork = r.movie?.artwork_key ?? t);
      } catch (r) {
        i === this.generation && s === this.detailRequest && (g(r) === "unauthorized" ? this.fail(r) : this.detailError = y(r));
      } finally {
        i === this.generation && s === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
      }
    }
  }
  async openLibraryTitle(e = !1) {
    if (!this.client || !this.scope?.library_enabled || !this.selected || this.detailsOnly)
      return;
    const t = this.generation, i = ++this.libraryRequest;
    try {
      const s = await this.client.viewingLibrary(
        this.scope,
        this.selected.id
      );
      if (t !== this.generation || i !== this.libraryRequest || !this.isConnected || e && !I())
        return;
      if (s.library) {
        if (e) {
          const r = this.renderRoot.querySelector(
            ".calendar-dialog"
          );
          r?.open && (this.preserveDetailOnClose = !0, r.close());
        }
        this.linkedTitleId = s.library.title_id, this.requestUpdate();
      } else
        this.detailError = "No linked Library entry is available.", this.requestUpdate();
    } catch (s) {
      if (t !== this.generation || i !== this.libraryRequest)
        return;
      g(s) === "unauthorized" ? this.fail(s) : (this.detailError = y(s), this.requestUpdate());
    }
  }
  browse(e, t) {
    !this.scope?.library_enabled || !this.movie || (this.closeDetails(), this.dispatchEvent(
      new CustomEvent("browse-library", {
        detail: { key: e, value: t },
        bubbles: !0,
        composed: !0
      })
    ), this.requestUpdate());
  }
  editViewing() {
    if (!this.selected || !this.editable || !this.scope?.permissions.edit || this.disabled || this.detailLoading)
      return;
    const e = this.selected.id;
    this.closeDetails(), this.dispatchEvent(
      new CustomEvent("edit-viewing", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    ), this.requestUpdate();
  }
  detailLink(e, t) {
    return this.detailsOnly ? t : a`<button
      type="button"
      class="link detail-link"
      @click=${() => this.browse(e, e === "query" ? JSON.stringify(t) : t)}
    >
      ${t}
    </button>`;
  }
  renderDetails() {
    const e = this.selected, t = this.movie, i = e ? new Date(e.started_at) : null, s = e?.ended_at ?? e?.completed_at, r = s ? new Date(s) : null, o = i && r && W(i) !== W(r), d = t?.duration_seconds ?? e?.duration_seconds;
    return a`<dialog
        class="database-dialog calendar-dialog"
        aria-labelledby="calendar-movie-title"
        @click=${q}
        @close=${(c) => {
      if (!c.target.open) {
        if (this.preserveDetailOnClose) {
          this.preserveDetailOnClose = !1;
          return;
        }
        this.closeDetails(), this.requestUpdate();
      }
    }}
      >
        <div class="card-head">
          <h2 id="calendar-movie-title">
            ${e && t && !this.detailsOnly ? a`<button type="button" class="link detail-link" @click=${() => {
      this.openLibraryTitle();
    }}>${e.title}</button>` : e?.title ?? "Viewing details"}
          </h2>
          ${S(() => {
      this.closeDetails(), this.requestUpdate();
    })}
        </div>
        ${e ? a`<div class="movie-detail">
                <kaleidescape-library-cover
                  .client=${this.client}
                  .scope=${this.scope}
                  .queue=${this.queue}
                  .artworkKey=${this.selectedArtwork}
                  .title=${e.title}
                  @access-denied=${() => this.fail({ code: "unauthorized" })}
                ></kaleidescape-library-cover>
                <div>
                  ${this.detailLoading ? a`<p role="status">Loading movie details…</p>` : l}
                  ${this.detailError ? a`<p class="error" role="alert">${this.detailError} <button @click=${() => this.openViewing(e, this.selectedArtwork)}>Retry details</button></p>` : l}
                  ${t ? a`<div class="detail-badges">
                            ${F(t, !1, this.detailsOnly ? void 0 : (c) => this.browse("format", c))}${fe(t.rating ?? "", this.detailsOnly ? void 0 : (c) => this.browse("rating", c))}
                          </div>
                          ${t.year ? a`<p><strong>Year:</strong> ${this.detailLink("year", String(t.year))}</p>` : l}
                          ${[
      ["Cast", t.actors],
      ["Directors", t.directors],
      ["Genres", t.genres]
    ].map(
      ([c, h]) => h?.length ? a`<p>
                                  <strong>${c}:</strong>
                                  ${h.map((u, p) => a`${p ? ", " : ""}${this.detailLink(c === "Genres" ? "genre" : "query", u)}`)}
                                </p>` : l
    )}` : !this.detailLoading && !this.detailError ? a`<p class="muted">
                            No linked Library metadata is available.
                          </p>` : l}
                  ${d != null ? a`<p><strong>Runtime:</strong> ${(d / 60).toFixed(2)} min</p>` : l}
                  <p>
                    <strong
                      >${o ? "Viewing dates" : "Viewing date"}:</strong
                    >
                    ${i?.toLocaleDateString()}${o ? ` – ${r.toLocaleDateString()}` : ""}
                  </p>
                  <p>
                    <strong>Watched:</strong>
                    ${(e.watched_seconds / 60).toFixed(2)} min ·
                    ${e.status === "completed" ? "Completed" : "Partial"}
                  </p>
                </div>
              </div>` : l}
        ${e && this.editable && this.scope?.permissions.edit ? a`<div class="dialog-footer">
                <button
                  class="primary"
                  ?disabled=${this.disabled || this.detailLoading}
                  @click=${this.editViewing}
                >
                  Edit viewing
                </button>
              </div>` : l}
      </dialog>
      ${this.linkedTitleId && !this.detailsOnly ? a`<kaleidescape-library
              .client=${this.client}
              .scope=${this.scope}
              .dialogOnly=${!0}
              .advanced=${this.editable}
              .openTitleId=${this.linkedTitleId}
              @title-dialog-closed=${() => {
      this.linkedTitleId !== void 0 && (this.linkedTitleId = void 0, this.requestUpdate());
    }}
              @title-dialog-error=${(c) => {
      this.linkedTitleId = void 0, this.detailError = c.detail, this.requestUpdate();
    }}
            ></kaleidescape-library>` : l}`;
  }
  render() {
    if (this.detailsOnly) return this.renderDetails();
    const e = this.month.getFullYear(), t = this.month.getMonth(), i = new Date(e, t, 1), s = new Date(e, t + 1, 0).getDate(), r = Math.ceil((i.getDay() + s) / 7) * 7, o = Array.from(
      { length: r },
      (c, h) => new Date(e, t, h - i.getDay() + 1)
    ), d = /* @__PURE__ */ new Map();
    for (const c of this.items)
      for (const { day: h, phase: u } of Us(c))
        d.set(h, [...d.get(h) ?? [], { row: c, phase: u }]);
    return a`<div class="month-bar">
        <button
          aria-label="Previous month"
          ?disabled=${this.disabled || e <= 100 && t === 0}
          @click=${() => this.move(-1)}
        >
          ←
        </button>
        <h2 aria-live="polite">
          ${this.month.toLocaleDateString(void 0, { month: "long", year: "numeric" })}
        </h2>
        <button
          aria-label="Next month"
          ?disabled=${this.disabled || e >= 9998 && t === 11}
          @click=${() => this.move(1)}
        >
          →
        </button>
        <button
          type="button"
          aria-label="Go to current month"
          ?disabled=${this.disabled}
          @click=${this.today}
        >
          Today
        </button>
      </div>
      <div class="calendar-scroll">
        <div
          class="month-grid"
          style=${`--calendar-day-size:${this.fitScreen ? this.fittedSize : this.daySize}px`}
          aria-label="Viewing calendar"
          aria-busy=${this.loading}
        >
          ${Array.from({ length: 7 }, (c, h) => a`<div class="weekday">${new Date(2023, 0, 1 + h).toLocaleDateString(void 0, { weekday: "short" })}</div>`)}
          ${o.map((c) => {
      const h = W(c), u = d.get(h) ?? [];
      return a`<section
              class=${`day${c.getMonth() !== t ? " other-month" : ""}${h === W(/* @__PURE__ */ new Date()) ? " today" : ""}`}
              aria-label=${c.toLocaleDateString()}
            >
              <time datetime=${h}>${c.getDate()}</time>
              ${u.length ? a`<div
                      class="cover-stack"
                      style=${`--spread:${1 + (u.length - 1) * 0.15}`}
                    >
                      ${Ia(
        u,
        ({ row: p }) => p.id,
        ({ row: p, phase: m }, w) => a`<button
                            class=${`poster poster-${m}`}
                            style=${`--index:${w};--layer:${w + 1}`}
                            aria-label=${`${p.title} · ${m === "start" ? "Started; completed on another day" : m === "completion" ? "Completed; started on another day" : p.status === "completed" ? "Completed" : "Partial"}`}
                            title=${p.title}
                            ?disabled=${this.disabled}
                            @click=${() => this.openViewing(p, p.artwork_key)}
                          >
                            <span class="poster-art"
                              ><kaleidescape-library-cover
                                .client=${this.client}
                                .scope=${this.scope}
                                .queue=${this.queue}
                                .artworkKey=${p.artwork_key}
                                .title=${p.title}
                                @access-denied=${() => this.fail({ code: "unauthorized" })}
                              ></kaleidescape-library-cover>
                              ${p.artwork_key ? l : a`<span class="poster-title">${p.title}</span>`}</span
                            >
                          </button>`
      )}
                    </div>` : l}
            </section>`;
    })}
        </div>
      </div>
      ${this.renderDetails()}`;
  }
};
Ge.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  query: { type: String },
  status: { type: String },
  fuzzy: { type: Boolean },
  libraryTitleId: { attribute: !1 },
  daySize: { type: Number },
  fitScreen: { type: Boolean },
  disabled: { type: Boolean },
  editable: { type: Boolean },
  rememberUrl: { type: Boolean },
  detailsOnly: { type: Boolean }
}, Ge.styles = [E, yt, Oa];
let Be = Ge;
customElements.get("kaleidescape-journal-calendar") || customElements.define("kaleidescape-journal-calendar", Be);
const Na = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  JournalCalendar: Be,
  calendarDays: Us,
  calendarMonth: Rs,
  dayKey: W,
  monthBounds: Ps
}, Symbol.toStringTag, { value: "Module" })), Fa = [
  "remote",
  "now-playing",
  "library-covers",
  "library-search",
  "library",
  "journal-calendar"
];
function Ts(n, e) {
  const t = {
    title: "",
    entry_id: "",
    player_id: "",
    channel: "main",
    columns: 5,
    page_size: 25,
    view: "covers",
    search_position: e === "library-covers" ? "off" : "top",
    show_filters: e !== "library-covers",
    show_sort: e !== "library-covers",
    show_stats: e !== "library-covers",
    show_titles: !0,
    show_format: !0,
    show_badges: !0,
    show_rating: !1,
    show_controls: !0,
    calendar_size: 100,
    calendar_fit: !1,
    ...n
  };
  for (const i of [
    "title",
    "entry_id",
    "player_id",
    "channel",
    "type"
  ])
    if (typeof t[i] != "string" || t[i].length > (i === "title" ? 200 : 128))
      throw new Error(`Invalid ${i}`);
  for (const [i, s, r] of [
    ["columns", 1, 20],
    ["page_size", 1, 1e3],
    ["calendar_size", 60, 320]
  ])
    if (!Number.isInteger(t[i]) || t[i] < s || t[i] > r)
      throw new Error(`${i} must be between ${s} and ${r}`);
  for (const i of [
    "show_filters",
    "show_sort",
    "show_stats",
    "show_titles",
    "show_format",
    "show_badges",
    "show_rating",
    "show_controls",
    "calendar_fit"
  ])
    if (typeof t[i] != "boolean") throw new Error(`Invalid ${i}`);
  if (!["top", "bottom", "off"].includes(t.search_position) || !["covers", "list"].includes(t.view))
    throw new Error("Invalid Library layout");
  return e === "library-covers" && Object.assign(t, {
    view: "covers",
    search_position: "off",
    show_filters: !1,
    show_sort: !1
  }), t;
}
function Va(n) {
  const e = (o) => ({ name: o, selector: { text: {} } }), t = (o) => ({ name: o, selector: { boolean: {} } }), i = (o, d, c) => ({
    name: o,
    selector: { number: { min: d, max: c, step: 1, mode: "box" } }
  }), s = n === "library" || n === "library-covers", r = Ts(
    { type: `custom:kaleidescape-${n}-card` },
    n
  );
  return {
    schema: [
      e("title"),
      e("entry_id"),
      ...n === "remote" || n === "now-playing" ? [e("player_id")] : [],
      ...n === "now-playing" ? [t("show_controls")] : [],
      ...s || n === "library-search" ? [e("channel")] : [],
      ...s ? [
        i("columns", 1, 20),
        i("page_size", 1, 1e3),
        ...[
          "show_titles",
          "show_format",
          "show_badges",
          "show_rating",
          "show_stats"
        ].map(t)
      ] : [],
      ...n === "library" ? [
        {
          name: "search_position",
          selector: { select: { options: ["top", "bottom", "off"] } }
        },
        {
          name: "view",
          selector: { select: { options: ["covers", "list"] } }
        },
        t("show_filters"),
        t("show_sort")
      ] : [],
      ...n === "journal-calendar" ? [
        i("calendar_size", 60, 320),
        t("calendar_fit"),
        e("channel")
      ] : []
    ].map((o) => ({
      ...o,
      default: r[o.name]
    })),
    computeLabel: (o) => o.name.replaceAll("_", " ").replace(/^./, (d) => d.toUpperCase()),
    computeHelper: (o) => o.name === "entry_id" ? "Leave blank for the loaded Companion integration." : o.name === "channel" ? "Search and Library cards with the same channel work together on this dashboard." : void 0
  };
}
const Et = "kaleidescape-companion-card-search", me = class me extends x {
  constructor() {
    super(...arguments), this.identity = "", this.generation = 0, this.error = "", this.query = "", this.locked = !1, this.visibility = () => {
      clearTimeout(this.timer), !document.hidden && this.api && this.refresh();
    }, this.receiveSearch = (e) => {
      if (!this.scope || !this.config || !["library", "library-covers"].includes(this.kind) || this.locked)
        return;
      const t = e.detail;
      t?.entry !== this.scope.entry_id || t?.dataset !== this.scope.dataset_id || t?.channel !== this.config.channel || typeof t?.query != "string" || t.query.length > 500 || (this.criterion = { key: "query", value: t.query }, this.requestUpdate());
    };
  }
  get kind() {
    return this.constructor.kind;
  }
  static getStubConfig() {
    return { channel: "main" };
  }
  static getConfigForm() {
    return Va(this.kind);
  }
  getCardSize() {
    return this.kind === "library-search" ? 2 : this.kind === "remote" ? 9 : 7;
  }
  getGridOptions() {
    return {
      columns: this.kind === "library" || this.kind === "journal-calendar" ? 24 : 12,
      min_columns: 6,
      rows: "auto"
    };
  }
  setConfig(e) {
    if (this.locked)
      throw new Error(
        "Finish the pending player command before reconfiguring this card."
      );
    if (!e || typeof e != "object")
      throw new Error("Card configuration is required");
    this.config = Ts(e, this.kind), this.reset(), this.requestUpdate("hass");
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener(Et, this.receiveSearch), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("hass");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener(Et, this.receiveSearch), document.removeEventListener("visibilitychange", this.visibility), this.reset();
  }
  reset() {
    this.generation++, clearTimeout(this.timer), this.api = void 0, this.scope = void 0, this.identity = "", this.boundConnection = void 0, this.criterion = this.popupCriterion = void 0, this.calendarStatus = void 0, this.query = this.error = "", this.locked = !1, this.renderRoot?.querySelector("dialog")?.close();
  }
  willUpdate(e) {
    if (!e.has("hass") || !this.config) return;
    const t = `${this.hass?.user?.id}:${this.hass?.user?.is_admin}:${this.hass?.connection.connected}`;
    t === this.identity && this.hass?.connection === this.boundConnection || (this.reset(), this.identity = t, this.boundConnection = this.hass?.connection, !(!this.hass?.connection.connected || !this.hass.user) && (this.api = new ki({
      callWS: (i) => this.hass.callWS(i),
      fetchWithAuth: (i, s) => this.hass.fetchWithAuth(i, s)
    }), this.refresh()));
  }
  async refresh() {
    if (!this.api || !this.config || !this.isConnected || document.hidden)
      return;
    clearTimeout(this.timer);
    const e = this.generation;
    try {
      const t = await this.api.info();
      if (e !== this.generation) return;
      const i = this.config.entry_id ? t.entries.find((s) => s.entry_id === this.config.entry_id) : t.entries[0];
      if (!i?.permissions.read || i.api_version !== 1)
        throw new v("not_ready");
      this.scope = {
        ...i,
        permissions: { read: !0, edit: !1, export: !1 }
      }, this.error = "";
    } catch (t) {
      if (e !== this.generation) return;
      this.scope = void 0, this.error = y(t);
    } finally {
      e === this.generation && (this.requestUpdate(), this.timer = setTimeout(() => {
        this.refresh();
      }, 3e4));
    }
  }
  deny() {
    this.reset(), this.error = "Access to Companion is unavailable. Check your HA account and integration.", this.requestUpdate();
  }
  search(e) {
    e.preventDefault(), !(!this.scope || !this.config) && window.dispatchEvent(
      new CustomEvent(Et, {
        detail: {
          entry: this.scope.entry_id,
          dataset: this.scope.dataset_id,
          channel: this.config.channel,
          query: this.query
        }
      })
    );
  }
  async browse(e) {
    this.popupCriterion = e, this.requestUpdate(), await this.updateComplete, this.renderRoot.querySelector("dialog")?.showModal();
  }
  closePopup(e) {
    const t = this.renderRoot.querySelector("dialog");
    if (this.locked || !(t?.querySelector("kaleidescape-library")?.confirmNavigation() ?? !0)) {
      e?.preventDefault();
      return;
    }
    t?.close();
  }
  render() {
    if (!this.config) return l;
    const e = this.config, t = () => a`<kaleidescape-library
        .client=${this.api}
        .scope=${this.scope}
        .dashboard=${e}
        .openCriterion=${this.criterion}
      ></kaleidescape-library>`;
    return a`<ha-card
      @access-denied=${this.deny}
      @control-lock=${(i) => {
      this.locked !== i.detail && (this.locked = i.detail, this.requestUpdate());
    }}
    >
      ${e.title ? a`<h2 class="card-title">${e.title}</h2>` : l}
      ${this.error ? a`<p class="message error" role="alert">
              ${this.error}
              <button
                @click=${() => {
      this.identity = "", this.requestUpdate("hass");
    }}
              >
                Retry
              </button>
            </p>` : this.scope ? this.kind === "remote" ? a`<div class="remote">
                  <kaleidescape-device-controls
                    .client=${this.api}
                    .scope=${this.scope}
                    .playerId=${e.player_id}
                    .inlineRemote=${!0}
                  ></kaleidescape-device-controls>
                </div>` : this.kind === "now-playing" ? a`<kaleidescape-now-playing
                    .client=${this.api}
                    .scope=${this.scope}
                    .playerId=${e.player_id}
                    .compact=${!0}
                    .showControls=${e.show_controls}
                  ></kaleidescape-now-playing>` : this.kind === "library-search" ? a`<form class="search" @submit=${this.search}>
                      <label
                        >Search titles, actors or directors<input
                          type="search"
                          maxlength="500"
                          .value=${this.query}
                          @input=${(i) => {
      this.query = i.target.value;
    }} /></label
                      ><button type="submit">Search</button
                      ><button
                        type="button"
                        @click=${(i) => {
      this.query = "", this.search(i), this.requestUpdate();
    }}
                      >
                        Clear
                      </button>
                    </form>` : this.kind === "journal-calendar" ? a`<kaleidescape-journal-calendar
                          .client=${this.api}
                          .scope=${this.scope}
                          .daySize=${e.calendar_size}
                          .fitScreen=${e.calendar_fit}
                          .rememberUrl=${!1}
                          @calendar-status=${(i) => {
      this.calendarStatus = i.detail, this.requestUpdate();
    }}
                          @browse-library=${(i) => {
      this.browse(i.detail);
    }}
                        ></kaleidescape-journal-calendar>
                        <footer class="calendar-footer">
                          <span
                            >${$i(this.scope, this.calendarStatus, !0)}</span
                          >${Ci(this.calendarStatus, () => {
      this.renderRoot.querySelector("kaleidescape-journal-calendar")?.refresh();
    })}
                        </footer>` : this.scope.library_enabled ? t() : a`<p class="message">
                          Library is disabled. An administrator can enable it in
                          Companion settings.
                        </p>` : a`<p class="message" role="status">
                ${this.hass?.user ? "Loading Companion…" : "Sign in to Home Assistant to use this card."}
              </p>`}
      ${this.popupCriterion && this.scope?.library_enabled ? a`<dialog @click=${q} @cancel=${this.closePopup}>
              <div class="card-head">
                <h2>Library</h2>
                ${S((i) => this.closePopup(i), this.locked)}
              </div>
              <kaleidescape-library
                .client=${this.api}
                .scope=${this.scope}
                .dashboard=${e}
                .openCriterion=${this.popupCriterion}
              ></kaleidescape-library>
            </dialog>` : l}
    </ha-card>`;
  }
};
me.kind = "library", me.properties = { hass: { attribute: !1 } }, me.styles = [
  E,
  vs,
  C`
      :host {
        display: block;
        min-width: 0;
      }
      ha-card {
        display: block;
        overflow: visible;
      }
      h2.card-title {
        padding: 12px 16px 0;
        margin: 0;
        font-size: 20px;
      }
      .message,
      .calendar-footer {
        padding: 12px 16px;
      }
      .search {
        display: flex;
        align-items: end;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px;
      }
      .search label {
        flex: 1;
        min-width: min(180px, 100%);
      }
      .search button {
        min-height: 44px;
      }
      .remote {
        max-width: 410px;
        margin: auto;
      }
      .calendar-footer {
        position: sticky;
        bottom: 0;
        z-index: 5;
        background: var(--surface);
        border-top: 1px solid var(--line);
        font-size: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      @media (max-width: 700px) {
        .calendar-footer {
          padding: 4px 8px max(4px, env(safe-area-inset-bottom));
          font-size: 11px;
          line-height: 16px;
          gap: 4px;
        }
      }
      dialog {
        width: min(1120px, calc(100% - 24px));
      }
    `
];
let _t = me;
const as = {
  remote: "Theater remote",
  "now-playing": "Now Playing",
  "library-covers": "Library covers",
  "library-search": "Library search",
  library: "Full Library",
  "journal-calendar": "Journal calendar"
}, Xt = window;
Xt.customCards ??= [];
for (const n of Fa) {
  const e = `kaleidescape-${n}-card`;
  if (!customElements.get(e)) {
    const i = class i extends _t {
    };
    i.kind = n;
    let t = i;
    customElements.define(e, t);
  }
  Xt.customCards.some((t) => t.type === e) || Xt.customCards.push({
    type: e,
    name: `Kaleidescape · ${as[n]}`,
    description: as[n],
    preview: !0
  });
}
class Qa {
  constructor(e, t) {
    this.host = e, this.resized = t, this.observed = [], this.containers = [], this.schedule = () => {
      this.frame !== void 0 || !this.host.isConnected || (this.frame = requestAnimationFrame(() => {
        if (this.frame = void 0, !this.host.isConnected) return;
        const i = Math.min(
          window.innerHeight,
          this.viewport?.height ?? window.innerHeight,
          document.documentElement.clientHeight || window.innerHeight
        ), s = Math.max(0, this.viewport?.offsetTop ?? 0), r = Math.max(0, window.innerHeight - i - s), o = this.observed.reduce(
          (L, j) => L + j.getBoundingClientRect().height,
          0
        ), d = parseFloat(
          getComputedStyle(this.host).getPropertyValue(
            "--companion-sticky-top"
          )
        ) || 0, c = this.observed.find(
          (L) => L.classList.contains("entries-header")
        ), h = this.observed.find(
          (L) => L.classList.contains("entries-footer")
        ), u = this.host.renderRoot.querySelector(".entries-layout"), p = Math.max(
          s + d + (c?.getBoundingClientRect().height ?? 0),
          u?.getBoundingClientRect().top ?? 0
        );
        let m = s + i;
        for (const L of this.containers.slice(1)) {
          if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(L).overflowY))
            continue;
          const j = L.getBoundingClientRect();
          j.height > 0 && (m = Math.min(m, j.bottom));
        }
        const w = {
          "--companion-viewport-height": i,
          "--companion-viewport-top": s,
          "--companion-viewport-bottom": r,
          "--entries-height": Math.max(
            180,
            u ? m - p - (h?.getBoundingClientRect().height ?? 0) - 16 : i - o - d - 16
          )
        };
        let A = !1;
        for (const [L, j] of Object.entries(w)) {
          const re = `${Math.round(j)}px`;
          this.host.style.getPropertyValue(L) !== re && (this.host.style.setProperty(L, re), A = !0);
        }
        A && this.resized?.();
      }));
    };
  }
  hostConnected() {
    this.viewport = window.visualViewport, window.addEventListener("resize", this.schedule), this.viewport?.addEventListener("resize", this.schedule), this.viewport?.addEventListener("scroll", this.schedule), this.observer = new ResizeObserver(this.schedule), this.host.requestUpdate(), this.schedule();
  }
  hostUpdated() {
    const e = [];
    let t = this.host;
    for (; t && e.length < 32; )
      e.push(t), t = t.parentElement ?? t.getRootNode().host ?? null;
    const i = [
      ...this.host.renderRoot.querySelectorAll(
        ".entries-header, .entries-footer"
      )
    ];
    (i.length !== this.observed.length || i.some((s, r) => s !== this.observed[r]) || e.length !== this.containers.length || e.some((s, r) => s !== this.containers[r])) && (this.observer?.disconnect(), [...i, ...e].forEach((s) => this.observer?.observe(s)), this.observed = i, this.containers = e), this.schedule();
  }
  hostDisconnected() {
    window.removeEventListener("resize", this.schedule), this.viewport?.removeEventListener("resize", this.schedule), this.viewport?.removeEventListener("scroll", this.schedule), this.viewport = void 0, this.observer?.disconnect(), this.observer = void 0, this.observed = [], this.containers = [], this.frame !== void 0 && cancelAnimationFrame(this.frame), this.frame = void 0;
  }
}
function Ai(n, e) {
  n.addController(new Qa(n, e));
}
const Ze = class Ze extends x {
  constructor() {
    super(...arguments), this.viewingId = "", this.disabled = !1, this.advanced = !1, this.autoOpen = !1, this.autoOpened = !1, this.queue = new T(), this.error = "", this.generation = 0, this.bound = "";
  }
  willUpdate(e) {
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}:${this.viewingId}`;
    if (t === this.bound && this.client === this.boundClient) {
      e.has("autoOpen") && (this.autoOpen ? this.openAutomatically() : (this.autoOpened && (this.openTitleId = void 0), this.autoOpened = !1));
      return;
    }
    this.clear(), this.bound = t, this.boundClient = this.client, this.reportLink(), this.load();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.queue.cache.dispose(), this.queue = new T(), this.openTitleId = void 0, this.autoOpened = !1, this.link = void 0, this.error = "";
  }
  async load() {
    if (!this.client || !this.scope?.library_enabled || !this.viewingId) return;
    const e = this.generation;
    try {
      const t = await this.client.viewingLibrary(
        this.scope,
        this.viewingId
      );
      e === this.generation && (this.link = t.library, this.reportLink(), this.openAutomatically());
    } catch (t) {
      if (e !== this.generation) return;
      this.error = y(t), g(t) === "unauthorized" && (this.clear(), this.requestUpdate(), this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      ));
    } finally {
      e === this.generation && this.requestUpdate();
    }
  }
  reportLink() {
    this.dispatchEvent(
      new CustomEvent("viewing-library-link", {
        detail: { viewingId: this.viewingId, linked: !!this.link },
        bubbles: !0,
        composed: !0
      })
    );
  }
  openAutomatically() {
    this.autoOpen && !this.autoOpened && this.link && !this.disabled && (this.autoOpened = !0, this.openLibrary());
  }
  openLibrary() {
    !this.link || this.disabled || (this.openTitleId = this.link.title_id, this.requestUpdate());
  }
  render() {
    return a` ${this.error ? a`<p class="error" role="alert">${this.error} <button @click=${this.load}>Retry Library link</button></p>` : l}
    ${this.scope?.library_enabled && this.link === null ? a`<p class="muted">No linked Library entry is available.</p>` : l}
    ${this.link ? a`<div class="linked-movie">
            <kaleidescape-library-cover
              .client=${this.client}
              .scope=${this.scope}
              .queue=${this.queue}
              .artworkKey=${this.link.artwork_key}
              .title=${this.link.title}
              @access-denied=${() => {
      this.clear(), this.requestUpdate(), this.dispatchEvent(
        new CustomEvent("access-denied", {
          bubbles: !0,
          composed: !0
        })
      );
    }}
            ></kaleidescape-library-cover>
          </div>` : l}
    ${this.openTitleId ? a`<kaleidescape-library
            .client=${this.client}
            .scope=${this.scope}
            .dialogOnly=${!0}
            .advanced=${this.advanced}
            .openTitleId=${this.openTitleId}
            @title-dialog-closed=${() => {
      this.openTitleId !== void 0 && (this.openTitleId = void 0, this.requestUpdate());
    }}
            @title-dialog-error=${(e) => {
      this.openTitleId = void 0, this.error = e.detail, this.requestUpdate();
    }}
          ></kaleidescape-library>` : l}`;
  }
};
Ze.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  viewingId: { type: String },
  disabled: { type: Boolean },
  advanced: { type: Boolean },
  autoOpen: { type: Boolean }
}, Ze.styles = [
  E,
  C`
      :host {
        display: block;
      }
      .linked-movie {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-block: 16px;
      }
      .linked-movie > div {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      kaleidescape-library-cover {
        width: 110px;
        height: 165px;
        flex: 0 0 110px;
        border-radius: 6px;
      }
      @media (max-width: 600px) {
        .linked-movie {
          gap: 10px;
          margin-block: 10px;
        }
        kaleidescape-library-cover {
          width: 72px;
          height: 108px;
          flex-basis: 72px;
        }
      }
    `
];
let Wt = Ze;
customElements.get("kaleidescape-viewing-library") || customElements.define("kaleidescape-viewing-library", Wt);
function $e(n) {
  const e = new Date(n);
  return new Date(e.getTime() - e.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
}
function rs(n) {
  return {
    title: n?.title ?? "",
    started_at: $e(n?.started_at ?? (/* @__PURE__ */ new Date()).toISOString()),
    ended_at: n?.ended_at ? $e(n.ended_at) : "",
    duration_seconds: n?.duration_seconds == null ? "" : (n.duration_seconds / 60).toFixed(2),
    watched_seconds: ((n?.watched_seconds ?? 0) / 60).toFixed(2),
    status: n?.status ?? "partial",
    notes: n?.notes ?? "",
    source_id: n?.source_id ?? "",
    player_id: n?.player_id ?? "",
    raw_content_id: n?.raw_content_id ?? ""
  };
}
function Ja(n, e, t, i = n) {
  const s = { ...n, [e]: t };
  if (e === "started_at") {
    const r = new Date(t).getTime(), o = new Date(i.started_at).getTime(), d = new Date(i.ended_at).getTime();
    t && i.ended_at && [r, o, d].every(Number.isFinite) && (s.ended_at = $e(
      new Date(r + d - o).toISOString()
    ));
  }
  return s;
}
function Ha(n, e) {
  const t = {};
  for (const [i, s] of Object.entries(n))
    e && s === e[i] || (i === "started_at" || i === "ended_at" ? t[i] = s ? new Date(s).toISOString() : null : i === "duration_seconds" || i === "watched_seconds" ? t[i] = s === "" ? null : Number(s) * 60 : ["source_id", "player_id", "raw_content_id"].includes(i) ? t[i] = s === "" ? null : s : t[i] = s);
  return t;
}
function _a(n, e, t) {
  function i(s, r, o = "text", d = !1, c) {
    return a`<label
      >${r}<input
        id=${s === "title" ? "title" : s}
        name=${s}
        type=${o}
        .value=${n[s]}
        ?required=${d}
        maxlength=${c ?? l}
        min=${o === "number" ? "0" : l}
        max=${o === "number" ? String(1e9 / 60) : l}
        step=${o === "datetime-local" ? "1" : o === "number" ? "0.01" : l}
        @input=${(h) => e(s, h)}
    /></label>`;
  }
  return a`
    <div class="grid">
      <div class="full">
        ${t ?? i("title", "Title", "text", !0, 500)}
      </div>
      ${i("started_at", "Started · local time", "datetime-local", !0)}
      ${i("ended_at", "Ended · local time", "datetime-local")}
      ${i("watched_seconds", "Watched minutes", "number", !0)}
      ${i("duration_seconds", "Runtime minutes · optional", "number")}
      <label
        >Status<select
          name="record_status"
          .value=${n.status}
          @change=${(s) => e("status", s)}
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
          @input=${(s) => e("notes", s)}
        ></textarea>
      </label>
    </div>
    <details>
      <summary>Source identifiers</summary>
      <div class="grid">
        ${i("source_id", "Source ID", "text", !1, 255)}
        ${i("player_id", "Player ID", "text", !1, 255)}
        <div class="full">
          ${i("raw_content_id", "Raw content ID", "text", !1, 255)}
        </div>
      </div>
      <small
        >Keep source identifiers exact. Titles do not establish movie
        identity.</small
      >
    </details>
  `;
}
const et = class et extends x {
  constructor() {
    super(...arguments), this.value = "", this.initialTitle = "", this.requireRuntime = !0, this.disabled = !1, this.fuzzySearch = !0, this.query = "", this.items = [], this.open = !1, this.active = 0, this.error = "", this.request = 0, this.bound = "";
  }
  willUpdate(e) {
    let t = !1;
    if (e.has("client") || e.has("scope")) {
      const i = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
      (i !== this.bound || this.client !== this.boundClient) && (this.clear(), this.bound = i, this.boundClient = this.client, t = !0);
    }
    e.has("initialTitle") && this.clear(), e.has("fuzzySearch") && !t && !this.selected && this.query && this.search(this.query), e.has("value") && this.selected && this.selected.id !== this.value && this.clear();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  clear() {
    clearTimeout(this.timer), this.request++, this.items = [], this.selected = void 0, this.query = this.initialTitle, this.open = !1, this.error = "";
  }
  change() {
    this.dispatchEvent(
      new CustomEvent("title-selection", {
        detail: { query: this.query, movie: this.selected ?? null },
        bubbles: !0,
        composed: !0
      })
    );
  }
  search(e) {
    if (this.disabled || !this.client || !this.scope) return;
    this.query = e, this.selected = void 0, this.items = [], this.open = !0, this.active = 0, this.error = "", this.change(), clearTimeout(this.timer);
    const t = ++this.request;
    this.timer = setTimeout(async () => {
      try {
        const i = await this.client.librarySearch(
          this.scope,
          e,
          this.fuzzySearch
        );
        t === this.request && this.isConnected && (this.items = i.items, this.requestUpdate());
      } catch (i) {
        t === this.request && (this.error = y(i), this.requestUpdate(), g(i) === "unauthorized" && this.dispatchEvent(
          new CustomEvent("access-denied", {
            bubbles: !0,
            composed: !0
          })
        ));
      }
    }, 200), this.requestUpdate();
  }
  choose(e) {
    this.disabled || this.requireRuntime && !e.duration_seconds || (this.selected = e, this.query = e.title, this.open = !1, this.items = [], this.change(), this.requestUpdate());
  }
  render() {
    return a`<fieldset ?disabled=${this.disabled}>
      <div class="manual-picker">
        <label
          >Movie from Library<input
            name="library_movie"
            maxlength="100"
            type="search"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded=${this.open && !!this.items.length}
            aria-controls="movie-suggestions"
            aria-activedescendant=${this.open && this.items[this.active] ? `movie-option-${this.active}` : l}
            .value=${this.query}
            @input=${(e) => this.search(e.target.value)}
            @focus=${() => {
      this.selected || this.search(this.query);
    }}
            @blur=${() => {
      this.open = !1, this.requestUpdate();
    }}
            @keydown=${(e) => {
      e.key === "Escape" ? (this.open = !1, this.requestUpdate()) : ["ArrowDown", "ArrowUp"].includes(e.key) && this.items.length ? (e.preventDefault(), this.active = (this.active + (e.key === "ArrowDown" ? 1 : -1) + this.items.length) % this.items.length, this.open = !0, this.requestUpdate()) : ["Enter", "Tab"].includes(e.key) && this.open && this.items[this.active] && (e.preventDefault(), this.choose(this.items[this.active]));
    }}
        /></label>
        ${this.open ? a`<div class="movie-suggestions" id="movie-suggestions" role="listbox">${this.items.map((e, t) => a`<button type="button" role="option" id=${`movie-option-${t}`} aria-selected=${this.active === t} ?disabled=${this.requireRuntime && !e.duration_seconds} @pointerdown=${(i) => i.preventDefault()} @click=${() => this.choose(e)}><strong>${e.title}</strong> · ${e.year ?? "Year unknown"} · ${(e.formats?.length ? e.formats : [e.edition]).filter(Boolean).join(", ")} · ${e.duration_seconds ? `${(e.duration_seconds / 60).toFixed(2)} min` : "Runtime unknown"}</button>`)}${this.items.length ? l : a`<small>Type a title; only cached Library movies can be selected.</small>`}</div>` : l}
      </div>
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      ${this.selected ? a`<p class="manual-metadata">${this.selected.year ?? ""} ${F(this.selected)} ${fe(this.selected.rating)} · ${((this.selected.duration_seconds ?? 0) / 60).toFixed(2)} min</p>` : l}
    </fieldset>`;
  }
};
et.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  value: { type: String },
  initialTitle: { type: String },
  requireRuntime: { type: Boolean },
  disabled: { type: Boolean },
  fuzzySearch: { attribute: !1 }
}, et.styles = [E, yt];
let Kt = et;
customElements.get("kaleidescape-library-title-picker") || customElements.define(
  "kaleidescape-library-title-picker",
  Kt
);
function Ie() {
  const n = $e((/* @__PURE__ */ new Date()).toISOString());
  return {
    library_title_id: "",
    date: n.slice(0, 10),
    time: n.slice(11, 16),
    status: "completed",
    watched_minutes: "",
    notes: ""
  };
}
function Ds(n) {
  if (!/^[a-f0-9]{64}$/.test(n.library_title_id))
    throw new Error("Select a Library movie from the suggestions.");
  const e = n.time.trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i);
  if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(n.date))
    throw new Error("Enter a date and time such as 19:30 or 7:30 PM.");
  let t = Number(e[1]);
  const i = Number(e[2] ?? 0), s = e[3]?.toLowerCase();
  if (i > 59 || t > (s ? 12 : 23) || s && t < 1)
    throw new Error("Enter a valid local time.");
  s && (t = t % 12 + (s === "pm" ? 12 : 0));
  const r = `${n.date}T${String(t).padStart(2, "0")}:${String(i).padStart(2, "0")}:00`, o = new Date(r);
  if (!Number.isFinite(o.getTime()) || $e(o.toISOString()) !== r)
    throw new Error(
      "That local date/time does not exist. Check the date or daylight-saving transition."
    );
  const d = Number(n.watched_minutes) * 60;
  if (n.status === "partial" && (!n.watched_minutes.trim() || !Number.isFinite(d) || d <= 0))
    throw new Error("Enter positive watched minutes for a partial viewing.");
  return {
    library_title_id: n.library_title_id,
    started_at: o.toISOString(),
    status: n.status,
    notes: n.notes,
    ...n.status === "partial" ? { watched_seconds: d } : {}
  };
}
const tt = class tt extends x {
  constructor() {
    super(...arguments), this.draft = Ie(), this.disabled = !1, this.fuzzySearch = !0, this.runtime = null;
  }
  change(e) {
    this.dispatchEvent(
      new CustomEvent("draft-change", {
        detail: { ...this.draft, ...e },
        bubbles: !0,
        composed: !0
      })
    );
  }
  render() {
    return a`<fieldset ?disabled=${this.disabled}>
      <kaleidescape-library-title-picker
        .client=${this.client}
        .scope=${this.scope}
        .value=${this.draft.library_title_id}
        .disabled=${this.disabled}
        .fuzzySearch=${this.fuzzySearch}
        @title-selection=${(e) => {
      this.runtime = e.detail.movie?.duration_seconds ?? null, this.change({ library_title_id: e.detail.movie?.id ?? "" });
    }}
      ></kaleidescape-library-title-picker>
      <div class="grid">
        <label
          >Started · local date<input
            name="viewing_date"
            type="date"
            .value=${this.draft.date}
            @input=${(e) => this.change({ date: e.target.value })}
        /></label>
        <label
          >Started · local time<input
            name="viewing_time"
            type="text"
            placeholder="19:30 or 7:30 PM"
            maxlength="16"
            .value=${this.draft.time}
            @input=${(e) => this.change({ time: e.target.value })}
        /></label>
        <label
          >Status<select
            name="record_status"
            .value=${this.draft.status}
            @change=${(e) => this.change({ status: e.target.value })}
          >
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
          </select></label
        >
        ${this.draft.status === "partial" ? a`<label>Watched minutes<input name="watched_minutes" type="number" min="0.01" step="0.01" max=${(this.runtime ?? 1e9) / 60} .value=${this.draft.watched_minutes} @input=${(e) => this.change({ watched_minutes: e.target.value })} /></label>` : l}
        <label class="full"
          >Notes<textarea
            name="notes"
            maxlength="10000"
            .value=${this.draft.notes}
            @input=${(e) => this.change({ notes: e.target.value })}
          ></textarea>
        </label>
      </div>
      <small
        >Runtime comes from the selected version. End time is start plus watched
        time; completed viewings use the full runtime.</small
      >
    </fieldset>`;
  }
};
tt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  draft: { attribute: !1 },
  disabled: { type: Boolean },
  fuzzySearch: { attribute: !1 }
}, tt.styles = [E, yt];
let Yt = tt;
customElements.get("kaleidescape-manual-viewing") || customElements.define("kaleidescape-manual-viewing", Yt);
const Li = C`
  .entries-header {
    position: sticky;
    top: var(--companion-sticky-top, 0px);
    z-index: 15;
    background: var(--surface);
    border-radius: 12px 12px 0 0;
  }
  .entries-layout {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.2fr);
    height: var(--entries-height, max(180px, calc(100dvh - 240px)));
    min-height: 0;
  }
  .entries-list,
  .entries-detail {
    padding: clamp(10px, 2vw, 20px);
    min-width: 0;
    min-height: 0;
  }
  .entries-list {
    display: flex;
    flex-direction: column;
  }
  .entries-list > .card-head {
    flex-shrink: 0;
  }
  .entries-detail {
    border-left: 1px solid var(--line);
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }
  .entry-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
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
  .entries-footer {
    position: sticky;
    bottom: 0;
    z-index: 14;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 16px;
    padding: 8px 14px max(8px, env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--line);
    border-radius: 0 0 12px 12px;
    color: var(--muted);
    font-size: 12px;
  }
  .entries-footer .pagination {
    border: 0;
    padding: 0;
    margin: 0;
    gap: 8px;
  }
  .entries-footer .pagination .actions {
    flex-wrap: nowrap;
  }
  @media (max-width: 700px) {
    .entries-layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(80px, 0.85fr) minmax(100px, 1.15fr);
    }
    .entries-detail {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .entries-header {
      border-radius: 8px 8px 0 0;
    }
    .entries-footer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 8px;
      padding-inline: 10px;
    }
    .entries-footer > span {
      grid-column: 1 / -1;
    }
    .entries-footer > span {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .entries-footer small {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 11px;
    }
    .entries-footer .pagination {
      display: contents;
    }
    .entries-footer .actions {
      gap: 4px;
    }
    .entries-footer button {
      padding-inline: 8px;
      font-size: 12px;
    }
    .entry-list li {
      gap: 8px;
      padding: 8px;
    }
  }
`, Xa = [
  "now-playing",
  "library",
  "journal",
  "database",
  "settings"
];
function Gt(n, e, t, i = !0) {
  const s = (o) => Xa.includes(o) && (e || o === "now-playing" || o === "journal" || o === "library") && (o !== "library" || t), r = i ? new URL(location.href).searchParams.get("companion_page") : null;
  return s(r) ? r : s(n) ? n : "journal";
}
function H(n) {
  const e = new URL(location.href);
  e.searchParams.set("companion_page", n), n !== "journal" && e.searchParams.delete("companion_month"), history.replaceState(history.state, "", e);
}
const zs = "data:image/png;base64,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", it = class it extends x {
  constructor() {
    super(), this.disabled = !1, this.status = "", this.mobileCompact = !1, this.view = "list", this.calendarSize = 180, this.calendarFit = !1, this.movieDetails = "full", this.bound = "", this.generation = 0, this.ready = !1, this.fuzzy = !0, this.error = "", Ce(this, () => !this.ready || this.store?.unsettled || this.viewStore?.unsettled || this.disabled || this.renderRoot.querySelector("dialog[open]") ? !1 : (this.clear(), this.load(), !0));
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    t === this.bound && this.client === this.boundClient || (this.clear(), this.bound = t, this.boundClient = this.client, this.load());
  }
  clear() {
    this.generation++, this.store?.dispose(), this.store = void 0, this.viewStore?.dispose(), this.viewStore = void 0, this.view = "list", this.calendarSize = 180, this.calendarFit = !1, this.movieDetails = "full", this.ready = !1, this.fuzzy = !0, this.error = "", this.renderRoot.querySelector("dialog")?.close();
  }
  notify() {
    this.dispatchEvent(
      new CustomEvent("journal-options", {
        detail: {
          fuzzy_search: this.fuzzy,
          view: this.view,
          calendar_size: this.calendarSize,
          calendar_fit: this.calendarFit,
          movie_details: this.movieDetails
        },
        bubbles: !0,
        composed: !0
      })
    );
  }
  fail(e) {
    this.error = y(e), g(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.requestUpdate();
  }
  async load() {
    if (!this.client || !this.scope) return;
    const e = ++this.generation;
    this.store?.dispose(), this.store = new O(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t ? this.fail(t) : (this.error = "", this.requestUpdate()));
      },
      "search"
    ), this.viewStore?.dispose(), this.viewStore = new O(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t ? this.fail(t) : (this.error = "", this.requestUpdate()));
      },
      "journal"
    );
    try {
      const [t, i] = await Promise.all([
        this.store.load(),
        this.viewStore.load()
      ]);
      if (e !== this.generation) return;
      this.fuzzy = t.fuzzy_search, this.view = i.view, this.calendarSize = i.calendar_size, this.calendarFit = i.calendar_fit, this.movieDetails = i.movie_details === "compact" ? "compact" : "full", ss(this.movieDetails === "full"), this.ready = !0, this.error = "", this.notify(), this.requestUpdate();
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  retry() {
    if (!this.ready) return this.load();
    this.store?.retry(), this.viewStore?.retry();
  }
  open() {
    this.ready && !this.disabled && this.renderRoot.querySelector("dialog")?.showModal();
  }
  render() {
    return a`<button
        type="button"
        class=${this.mobileCompact ? "desktop-options" : ""}
        ?disabled=${!this.ready || this.disabled}
        @click=${this.open}
      >
        Options
      </button>
      ${this.error ? a`<span class="error" role="alert">${this.error}<button @click=${this.retry}>Retry Journal options</button></span>` : l}
      <dialog
        class="database-dialog"
        aria-labelledby="journal-options-title"
        @click=${q}
      >
        <div class="card-head">
          <h2 id="journal-options-title">Journal options</h2>
          ${S(() => this.renderRoot.querySelector("dialog")?.close())}
        </div>
        <p>
          Changes save automatically for your HA user’s
          ${this.viewStore?.profile} layout.
        </p>
        <label
          >Status<select
            name="filter_status"
            .value=${this.status}
            @change=${(e) => {
      this.status = e.target.value, this.dispatchEvent(
        new CustomEvent("journal-status", {
          detail: this.status,
          bubbles: !0,
          composed: !0
        })
      );
    }}
          >
            <option value="">All</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
          </select></label
        >
        <label class="check"
          ><input
            name="journal_fuzzy_search"
            type="checkbox"
            .checked=${this.fuzzy}
            @change=${(e) => {
      this.fuzzy = e.target.checked, this.store?.set({ fuzzy_search: this.fuzzy }), this.notify(), this.requestUpdate();
    }}
          />Fuzzy search</label
        >
        <p class="muted">
          Applies across all views for your HA user, including Library search
          and Movie from Library completion. Off matches literal text, ignoring
          case. On also tolerates small spelling mistakes and word order
          differences.
        </p>
        <label
          >Movie details<select
            name="journal_movie_details"
            .value=${this.movieDetails}
            @change=${(e) => {
      this.movieDetails = e.target.value === "compact" ? "compact" : "full", this.viewStore?.set({ movie_details: this.movieDetails }), ss(this.movieDetails === "full"), this.notify(), this.requestUpdate();
    }}
          >
            <option value="full">Full movie details</option>
            <option value="compact">Compact movie details</option>
          </select></label
        >
        <label class="check"
          ><input
            name="journal_calendar_view"
            type="checkbox"
            .checked=${this.view === "calendar"}
            @change=${(e) => {
      this.view = e.target.checked ? "calendar" : "list", this.viewStore?.set({ view: this.view }), this.notify(), this.requestUpdate();
    }}
          />Calendar view</label
        >
        <p class="muted">
          Show local start and completion dates, with diagonally cut covers for
          cross-day viewings. Off restores the entry list.
        </p>
        ${this.view === "calendar" ? a`
                <label
                  >Calendar size · ${this.calendarSize} px
                  <input
                    name="journal_calendar_size"
                    type="range"
                    min="60"
                    max="320"
                    step="1"
                    .value=${String(this.calendarSize)}
                    ?disabled=${this.calendarFit}
                    @input=${(e) => {
      this.calendarSize = Number(
        e.target.value
      ), this.notify(), this.requestUpdate();
    }}
                    @change=${() => this.viewStore?.set({ calendar_size: this.calendarSize })}
                  />
                </label>
                <label class="check"
                  ><input
                    name="journal_calendar_fit"
                    type="checkbox"
                    .checked=${this.calendarFit}
                    @change=${(e) => {
      this.calendarFit = e.target.checked, this.viewStore?.set({ calendar_fit: this.calendarFit }), this.notify(), this.requestUpdate();
    }}
                  />Fit month to screen</label
                >
                <p class="muted">
                  Size controls the day rows and covers. Fit uses the available
                  screen height; very small screens may still need scrolling.
                </p>
              ` : l}
        <div class="dialog-footer">
          <button
            type="button"
            ?disabled=${this.disabled}
            @click=${() => this.dispatchEvent(new CustomEvent("journal-refresh", { bubbles: !0, composed: !0 }))}
          >
            Refresh Journal
          </button>
        </div>
      </dialog>`;
  }
};
it.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean },
  status: { type: String },
  mobileCompact: { type: Boolean }
}, it.styles = [
  E,
  C`
      @media (max-width: 700px) {
        .desktop-options {
          display: none;
        }
      }
    `
];
let Zt = it;
customElements.get("kaleidescape-journal-options") || customElements.define("kaleidescape-journal-options", Zt);
const st = class st extends x {
  constructor() {
    super(), this.narrow = !1, this.api = null, this.userKey = "", this.generation = 0, this.scope = null, this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest = 0, this.loading = !1, this.error = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.sort = "completed_at", this.descending = !0, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.next = null, this.history = [], this.page = 1, this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.controlLocked = !1, this.locationChanged = () => {
      this.navigationReady && this.scope?.library_enabled && this.activePage !== "library" && Se() && je() && this.selectPage("library");
    }, Ai(this);
  }
  confirmNavigation() {
    return !this.controlLocked && (this.renderRoot.querySelector("kaleidescape-library")?.confirmNavigation() ?? !0);
  }
  announcePage() {
    this.dispatchEvent(
      new CustomEvent("page-changed", {
        detail: this.activePage,
        bubbles: !0,
        composed: !0
      })
    );
  }
  willUpdate(e) {
    if (!(!e.has("hass") && !e.has("client")))
      if (this.hass) {
        const t = `${this.hass.user?.id}:${this.hass.user?.is_admin}`;
        !this.hass.user || !this.hass.connection.connected ? this.bind(null) : (this.connection !== this.hass.connection || this.userKey !== t || !this.api) && (this.connection = this.hass.connection, this.userKey = t, this.bind(
          new ki({
            callWS: (i) => this.hass.callWS(i),
            fetchWithAuth: (i, s) => this.hass.fetchWithAuth(i, s)
          })
        ));
      } else this.bind(this.client ?? null);
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("location-changed", this.locationChanged), window.addEventListener("popstate", this.locationChanged), this.unwatchMovieDialog = Ei(() => {
      I() && this.selected && (this.movieSelectionId = this.selected.id), this.requestUpdate();
    }), this.requestUpdate("hass"), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener("location-changed", this.locationChanged), window.removeEventListener("popstate", this.locationChanged), this.unwatchMovieDialog?.(), this.unwatchMovieDialog = void 0, this.bind(null);
  }
  clear() {
    this.controlLocked = !1, this.generation++, this.scope = null, this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest++, this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.query = this.status = this.searchText = this.filterStatus = "", this.sort = "completed_at", this.descending = !0, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.calendarStatus = void 0, this.journalMovie = void 0, this.libraryTitleId = void 0, this.libraryCriterion = void 0, this.loading = !1, this.error = "";
  }
  bind(e) {
    e !== this.api && (this.clear(), this.api = e, this.requestUpdate(), e && this.refresh());
  }
  fail(e) {
    g(e) === "unauthorized" && this.clear(), this.error = y(e), this.requestUpdate();
  }
  async refresh() {
    if (!this.api) return;
    const e = ++this.generation;
    this.scope = null, this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest++, this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const { entries: t } = await this.api.info();
      if (e !== this.generation) return;
      if (!t[0]?.permissions.read || t[0].api_version !== 1)
        throw new v("not_ready");
      if (this.scope = {
        ...t[0],
        permissions: { read: !0, edit: !1, export: !1 }
      }, !this.navigationReady) {
        const i = Gt(
          this.scope.ui_defaults?.default_landing_page,
          !1,
          !!this.scope.library_enabled
        );
        this.activePage = i === "library" || i === "now-playing" ? i : "journal", this.navigationReady = !0;
      }
      this.activePage === "library" && !this.scope.library_enabled && (this.activePage = "journal"), H(this.activePage), this.announcePage(), await this.load(void 0, e);
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async load(e, t = ++this.generation) {
    if (!(!this.api || !this.scope)) {
      this.loading = !0, this.error = "", this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest++, this.requestUpdate();
      try {
        const i = await this.api.list(
          this.scope,
          this.query,
          this.status,
          e,
          this.sort,
          this.descending,
          this.fuzzySearch,
          this.journalMovie?.id
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
  selectJournalEntry(e) {
    return this.selectRecord(e, !0);
  }
  async selectRecord(e, t = !1) {
    if (!this.api || !this.scope) return;
    this.movieSelectionId = t ? e : void 0;
    const i = this.generation, s = ++this.detailRequest;
    this.selected = null, this.detailLoading = !0, this.requestUpdate();
    try {
      const r = await this.api.get(this.scope, e);
      i === this.generation && s === this.detailRequest && (this.selected = r);
    } catch (r) {
      i === this.generation && s === this.detailRequest && this.fail(r);
    } finally {
      i === this.generation && s === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  date(e) {
    if (!e) return "—";
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? "—" : t.toLocaleString();
  }
  selectPage(e, t) {
    this.controlLocked || e === "library" && !this.scope?.library_enabled || (this.selected = null, this.detailLoading = !1, this.detailRequest++, this.libraryTitleId = t?.libraryTitleId, this.libraryCriterion = t?.libraryCriterion, this.activePage = e, e === "journal" && (this.journalMovie = t?.movie, this.query = this.searchText = this.status = this.filterStatus = "", this.page = 1, this.history = [], this.load()), H(e), this.announcePage(), this.requestUpdate());
  }
  tabKey(e) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const t = [
      "now-playing",
      ...this.scope?.library_enabled ? ["library"] : [],
      "journal"
    ], i = t.indexOf(this.activePage), s = e.key === "Home" ? t[0] : e.key === "End" ? t.at(-1) : t[(i + (e.key === "ArrowRight" ? 1 : -1) + t.length) % t.length];
    this.selectPage(s), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#reader-${s}`)?.focus()
    );
  }
  clearJournalSearch() {
    this.query = this.searchText = "", this.page = 1, this.history = [], this.load(), this.requestUpdate();
  }
  render() {
    const e = this.journalView === "calendar" && !this.query.trim();
    return a`<main>
      <header>
        ${this.hass && this.narrow ? a`<button aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : l}
        <img
          class="companion-icon"
          src=${zs}
          alt=""
          aria-hidden="true"
        />
        <div>
          <span class="eyebrow">Kaleidescape Companion</span>
          <h1>Viewing history</h1>
          <p>
            ${this.activePage === "now-playing" ? "Household playback controls" : "Read-only household journal"}
          </p>
        </div>
      </header>
      ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
      <div class="page-navigation">
        <nav
          class="page-tabs"
          role="tablist"
          aria-label="Companion pages"
          @keydown=${this.tabKey}
        >
          ${["now-playing", "library", "journal"].map((t) => a`<button id=${`reader-${t}`} role="tab" aria-controls="reader-content" aria-selected=${this.activePage === t} tabindex=${this.activePage === t ? 0 : -1} ?disabled=${t === "library" && !this.scope?.library_enabled} @click=${() => this.selectPage(t)}>${t === "now-playing" ? "Now Playing" : t === "journal" ? "Journal" : "Library"}</button>`)}
        </nav>
        <span class="view-mode-slot"><slot name="view-mode"></slot></span>
      </div>
      <section
        id="reader-content"
        @control-lock=${(t) => {
      this.controlLocked !== t.detail && (this.controlLocked = t.detail, this.requestUpdate());
    }}
        role="tabpanel"
        aria-labelledby=${`reader-${this.activePage}`}
        @playback-started=${(t) => {
      this.playbackPlayer = t.detail, this.selectPage("now-playing");
    }}
      >
        ${this.activePage === "now-playing" && this.scope ? a`<kaleidescape-now-playing
                .playerId=${this.playbackPlayer}
                .client=${this.api ?? void 0}
                .scope=${this.scope}
                @access-denied=${() => this.fail(new v("unauthorized"))}
              ></kaleidescape-now-playing>` : this.activePage === "library" && this.scope ? a`<kaleidescape-library
                  .client=${this.api ?? void 0}
                  .scope=${this.scope}
                  .openTitleId=${this.libraryTitleId}
                  .openCriterion=${this.libraryCriterion}
                  @access-denied=${() => this.fail(new v("unauthorized"))}
                  @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
                ></kaleidescape-library>` : a`<section
                  class=${`card journal${e ? " journal-calendar-mode" : ""}`}
                  aria-label="Viewing history"
                >
                  <div class="entries-header">
                    ${e ? a`<kaleidescape-journal-shortcuts
                            .context=${this.api}
                            .scopeKey=${`${this.scope?.entry_id}:${this.scope?.dataset_id}`}
                            .value=${this.searchText}
                            .disabled=${this.loading || !this.scope}
                            .allowAdd=${!1}
                            .filtered=${!!this.status || !!this.journalMovie}
                            .filterLabel=${this.journalMovie ? `Viewings for ${this.journalMovie.title}` : ""}
                            @journal-search=${(t) => {
      this.query = this.searchText = t.detail.trim(), this.page = 1, this.history = [], this.load();
    }}
                            @journal-open-options=${() => this.renderRoot.querySelector("kaleidescape-journal-options")?.open()}
                            @journal-clear-movie=${() => this.selectPage("journal")}
                          ></kaleidescape-journal-shortcuts>` : l}
                    ${this.journalMovie ? a`<p class="journal-movie-filter">Viewings for ${this.journalMovie.title} <button @click=${() => this.selectPage("journal")}>Show all viewings</button></p>` : l}
                    ${this.query.trim() ? a`<button type="button" class="journal-search-chip" aria-label=${`Clear search: ${this.query}`} ?disabled=${this.loading || !this.scope} @click=${this.clearJournalSearch}><span>${this.query}</span><span aria-hidden="true">×</span></button>` : l}
                    <form
                      class="filters journal-filters"
                      @submit=${(t) => {
      t.preventDefault(), this.query = this.searchText = this.searchText.trim(), this.status = this.filterStatus, this.history = [], this.page = 1, this.load();
    }}
                    >
                      <label
                        >Search titles<span class="journal-search-input"
                          ><input
                            name="search"
                            type="search"
                            maxlength="500"
                            .value=${this.searchText}
                            ?disabled=${this.loading || !this.scope}
                            @input=${(t) => {
      this.searchText = t.target.value, !this.searchText && this.query && this.clearJournalSearch();
    }}
                          />${this.query.trim() ? a`<button type="button" class="journal-clear-search" aria-label="Clear Journal search" title="Clear search" ?disabled=${this.loading || !this.scope} @click=${this.clearJournalSearch}>×</button>` : l}</span
                        ></label
                      >
                      <div class="journal-filter-tools">
                        <label ?hidden=${e}
                          >Sort by<select
                            name="journal_sort"
                            .value=${this.sort}
                            ?disabled=${this.loading || !this.scope}
                            @change=${(t) => {
      this.sort = t.target.value, this.page = 1, this.history = [], this.load();
    }}
                          >
                            <option value="completed_at">
                              Completed date · partial first
                            </option>
                            <option value="title">Title</option>
                          </select></label
                        >
                        <button
                          type="button"
                          ?hidden=${e}
                          ?disabled=${this.loading || !this.scope}
                          @click=${() => {
      this.descending = !this.descending, this.page = 1, this.history = [], this.load();
    }}
                        >
                          ${this.descending ? "Descending ↓" : "Ascending ↑"}
                        </button>
                      </div>
                      <button
                        class="journal-search-button"
                        ?disabled=${this.loading || !this.scope}
                      >
                        Search
                      </button>
                      <div class="journal-toolbar">
                        <button
                          type="button"
                          ?disabled=${this.loading || !this.api}
                          @click=${this.refresh}
                        >
                          Refresh</button
                        ><kaleidescape-journal-options
                          .mobileCompact=${e}
                          @journal-refresh=${() => this.refresh()}
                          .status=${this.status}
                          @journal-status=${(t) => {
      this.status = this.filterStatus = t.detail, this.page = 1, this.history = [], this.load(), this.requestUpdate();
    }}
                          .client=${this.api}
                          .scope=${this.scope}
                          .disabled=${this.loading}
                          @journal-options=${(t) => {
      this.journalView = t.detail.view, this.calendarSize = t.detail.calendar_size, this.calendarFit = t.detail.calendar_fit, this.requestUpdate();
      const i = this.fuzzySearch !== t.detail.fuzzy_search;
      this.fuzzySearch = t.detail.fuzzy_search, i && (this.page = 1, this.history = [], this.load());
    }}
                          @access-denied=${() => this.fail(new v("unauthorized"))}
                        ></kaleidescape-journal-options>
                      </div>
                    </form>
                  </div>
                  ${e ? a`<kaleidescape-journal-calendar
                          @calendar-status=${(t) => {
      this.calendarStatus = t.detail, this.requestUpdate();
    }}
                          .client=${this.api ?? void 0}
                          .scope=${this.scope ?? void 0}
                          .query=${this.query}
                          .status=${this.status}
                          .fuzzy=${this.fuzzySearch}
                          .libraryTitleId=${this.journalMovie?.id}
                          .daySize=${this.calendarSize}
                          .fitScreen=${this.calendarFit}
                          @browse-library=${(t) => this.selectPage("library", { libraryCriterion: t.detail })}
                          @access-denied=${() => this.fail(new v("unauthorized"))}
                        ></kaleidescape-journal-calendar>` : a`
                          <div class="entries-layout">
                            <section
                              class="entries-list"
                              aria-label="Journal entries"
                            >
                              <div class="card-head">
                                <h2>
                                  Viewings (${this.scope?.viewing_count ?? 0})
                                </h2>
                              </div>
                              ${this.loading ? a`<div class="empty" role="status">
                                      Loading viewings…
                                    </div>` : this.api ? this.rows.length ? a`<ul
                                          class="entry-list"
                                          tabindex="0"
                                          aria-label="Viewings"
                                        >
                                          ${this.rows.map((t) => ms(t, this.selected?.id, (i) => {
      this.selectJournalEntry(i);
    }))}
                                        </ul>` : a`<div class="empty">
                                          No viewings to display.
                                        </div>` : a`<p>
                                        Sign in to Home Assistant to view the
                                        household journal.
                                      </p>`}
                            </section>
                            <section
                              class="entries-detail"
                              aria-label="Viewing details"
                              tabindex="0"
                            >
                              <div class="card-head">
                                <h2>Viewing details</h2>
                              </div>
                              ${this.detailLoading ? a`<div class="empty" role="status">
                                      Loading entry…
                                    </div>` : this.selected ? a`${bs(
      this.selected,
      (t) => this.date(t),
      this.linkedViewingId === this.selected.id ? () => this.renderRoot.querySelector(
        "kaleidescape-viewing-library"
      )?.openLibrary() : void 0
    )}
                                        <kaleidescape-viewing-library
                                          .client=${this.api ?? void 0}
                                          .scope=${this.scope ?? void 0}
                                          .viewingId=${this.selected.id}
                                          .autoOpen=${I() && this.movieSelectionId === this.selected.id}
                                          @viewing-library-link=${(t) => {
      if (this.selected?.id !== t.detail.viewingId)
        return;
      const i = t.detail.linked ? t.detail.viewingId : void 0;
      this.linkedViewingId !== i && (this.linkedViewingId = i, this.requestUpdate());
    }}
                                          @access-denied=${() => this.fail(new v("unauthorized"))}
                                          @browse-library=${(t) => this.selectPage("library", { libraryCriterion: t.detail })}
                                        ></kaleidescape-viewing-library> ` : a`<div class="empty">
                                        <strong>Select an entry</strong>
                                        <p>
                                          View its watching history and
                                          duration.
                                        </p>
                                      </div>`}
                            </section>
                          </div>
                        `}
                  <footer class="entries-footer journal-status">
                    <span
                      >${$i(this.scope, e ? this.calendarStatus : void 0, e)}</span
                    >${e ? Ci(this.calendarStatus, () => {
      this.renderRoot.querySelector(
        "kaleidescape-journal-calendar"
      )?.refresh();
    }) : l}

                    <div class="pagination" ?hidden=${e}>
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
                  </footer>
                </section>`}
      </section>
    </main>`;
  }
};
st.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, st.styles = [E, Li, ys];
let ei = st;
customElements.get("kaleidescape-reader") || customElements.define("kaleidescape-reader", ei);
const ti = [
  ["actors", "Cast", ["kaleidescape", "tmdb"]],
  ["directors", "Directors", ["kaleidescape", "tmdb"]],
  ["writers", "Writers", ["kaleidescape", "tmdb"]],
  ["producers", "Producers", ["kaleidescape", "tmdb"]],
  ["studios", "Studios", ["kaleidescape", "tmdb"]],
  ["synopsis", "Synopsis", ["kaleidescape", "tmdb"]],
  ["genres", "Genres", ["kaleidescape", "tmdb"]],
  ["distributor", "Distributor", ["kaleidescape"]],
  ["critic_score", "Rotten Tomatoes critics", ["kaleidescape"]],
  ["audience_score", "Rotten Tomatoes audience", ["kaleidescape"]],
  ["audience_rating", "TMDB viewer rating", ["tmdb"]],
  ["audience_votes", "TMDB audience votes", ["tmdb"]],
  ["artwork", "Cover artwork", ["kaleidescape", "tmdb"]],
  ["backdrop", "Landscape image", ["tmdb"]]
], Wa = {
  auto: "Automatic",
  original: "Original library data",
  kaleidescape: "Kaleidescape store",
  tmdb: "TMDB"
}, G = [
  [
    "general",
    "General",
    "Make Companion feel at home",
    "Landing page, personal search and display preferences."
  ],
  [
    "journal",
    "Journal",
    "Build your viewing journal",
    "Connect the playback sources and choose what counts as a viewing."
  ],
  [
    "library",
    "Library",
    "Bring your collection together",
    "Local scanning, artwork storage and collection visibility."
  ],
  [
    "playback",
    "Playback",
    "Choose how you control playback",
    "Connect your system and select the player used by Companion."
  ],
  [
    "metadata",
    "Metadata",
    "Fill in the details",
    "Optional providers, credentials and preferred sources for movie information."
  ],
  [
    "calendar",
    "Calendar",
    "Share your viewing history",
    "Publish completions, format events and manage a dedicated calendar."
  ],
  [
    "automations",
    "Automations",
    "Set up your recurring workflows",
    "Install and update blueprints, then configure their inputs in Home Assistant."
  ],
  [
    "maintenance",
    "Maintenance",
    "Manage and maintain Companion",
    "Settings transfer, metadata repair and a test dashboard."
  ],
  [
    "about",
    "About",
    "About Kaleidescape Companion",
    "Installed versions, documentation and support information."
  ]
], Pe = [
  {
    key: "media_player",
    label: "Media player",
    hint: "The built-in Kaleidescape media player to observe.",
    section: "journal",
    type: "text",
    placeholder: "media_player.your_player"
  },
  {
    key: "play_status",
    label: "Play-status sensor",
    hint: "Choose the exact play-status sensor for that player, including credits status.",
    section: "journal",
    type: "text",
    placeholder: "sensor.your_player_play_status"
  },
  {
    key: "media_location",
    label: "Media-location sensor",
    hint: "Choose the sensor that distinguishes main content from trailers and other material.",
    section: "journal",
    type: "text",
    placeholder: "sensor.your_player_media_location"
  },
  {
    key: "minimum_runtime_minutes",
    label: "Minimum movie runtime",
    hint: "Ignore shorter titles. Set to 0 to include every runtime; unknown runtimes wait for metadata.",
    section: "journal",
    type: "number",
    min: 0,
    max: 1440,
    unit: "minutes"
  },
  {
    key: "minimum_seconds",
    label: "Playback before credits completion",
    hint: "Main-content watch time required before confirmed credits can complete a viewing.",
    section: "journal",
    type: "number",
    min: 1,
    max: 3600,
    unit: "seconds"
  },
  {
    key: "resume_hours",
    label: "Resume window",
    hint: "Combine partial viewings resumed within this window. Set to 0 to keep them separate.",
    section: "journal",
    type: "number",
    min: 0,
    max: 168,
    unit: "hours"
  }
], Ue = [
  {
    key: "library_host",
    label: "Kaleidescape Server Address",
    hint: "A local hostname or private IP address. Leave blank to use my-kaleidescape.local.",
    section: "library",
    type: "text",
    placeholder: "my-kaleidescape.local"
  },
  {
    key: "library_recent_purchase_weeks",
    label: "Recently Added purchase window",
    hint: "Show the Recently Added badge for recent purchases. Set to 0 to disable the purchase window.",
    section: "library",
    type: "number",
    min: 0,
    max: 520,
    unit: "weeks"
  },
  {
    key: "library_artwork_cache_mb",
    label: "Artwork storage limit",
    hint: "Older cached images can be removed and fetched again when space is needed.",
    section: "library",
    type: "number",
    min: 32,
    max: 4096,
    unit: "MiB"
  }
], Ri = [
  [
    "tracking_enabled",
    "Automatically record playback",
    "Add viewings to the Journal using the selected Home Assistant entities.",
    "journal"
  ],
  [
    "library_enabled",
    "Enable Library sync",
    "Read your local movie catalog. No Library requests run while this is off.",
    "library"
  ],
  [
    "library_sync_collections",
    "Collections and watched status",
    "Read collection membership and playback status from the system.",
    "library"
  ],
  [
    "library_sync_details",
    "Movie details and credits",
    "Include synopsis, cast and other details available from the source.",
    "library"
  ],
  [
    "library_sync_artwork",
    "Cover artwork",
    "Download covers to Companion's private image cache.",
    "library"
  ],
  [
    "library_allow_collection_add",
    "Allow collection changes",
    "Let administrators queue changes for a selected edition on the device. Requires collection sync. Watched and Unwatched are moves; In Progress requires playback to add.",
    "library"
  ],
  [
    "control_enabled",
    "Enable playback controls",
    "Make the remote available to active Home Assistant users.",
    "playback"
  ],
  [
    "control_allow_launch",
    "Allow Library title playback",
    "Experimental: launch a selected Library movie on your player. The player chooses the playable format.",
    "playback"
  ],
  [
    "calendar_enabled",
    "Add watched movies to calendar",
    "Publish new movie completions to your selected calendar.",
    "calendar"
  ]
], Ka = /* @__PURE__ */ new Set([
  ...Ri.map(([n]) => n),
  "calendar_full_sync",
  "calendar_full_sync_dedicated",
  "metadata_store_enabled",
  "metadata_tmdb_enabled",
  "metadata_auto_save",
  "metadata_clear_tmdb_key"
]), js = [
  ...Pe,
  ...Ue,
  ...Ri.map(([n, e, t, i]) => ({
    key: n,
    label: e,
    hint: t,
    section: i
  })),
  ...[
    [
      "default_landing_page",
      "Default landing page",
      "general",
      "Shared starting page"
    ],
    [
      "personal_fuzzy_search",
      "Fuzzy search",
      "general",
      "Personal spelling and partial matches"
    ],
    [
      "hidden_collections",
      "Hidden collection names",
      "library",
      "Shared labels and filter visibility"
    ],
    [
      "control_host",
      "Kaleidescape Player Address",
      "playback",
      "Private LAN hostname or IP"
    ],
    [
      "control_player",
      "Default player",
      "playback",
      "Discover and select a player"
    ],
    [
      "metadata_store_enabled",
      "Kaleidescape Store",
      "metadata",
      "Public Store metadata provider"
    ],
    ["metadata_tmdb_enabled", "TMDB", "metadata", "Movie metadata provider"],
    [
      "metadata_tmdb_credential",
      "TMDB credential",
      "metadata",
      "API key or read access token"
    ],
    [
      "metadata_clear_tmdb_key",
      "Remove TMDB credential",
      "metadata",
      "Clear saved key"
    ],
    [
      "metadata_auto_save",
      "Auto-save metadata edits",
      "metadata",
      "Save per-movie manager changes immediately"
    ],
    [
      "metadata_requests_per_second",
      "Request rate",
      "metadata",
      "Shared provider requests per second"
    ],
    [
      "calendar_entity",
      "Calendar destination",
      "calendar",
      "Home Assistant calendar"
    ],
    ["calendar_title", "Event title", "calendar", "Template placeholders"],
    [
      "calendar_description",
      "Event description",
      "calendar",
      "Template placeholders"
    ],
    [
      "calendar_full_sync",
      "Full Sync",
      "calendar",
      "Maintain a dedicated calendar"
    ],
    [
      "calendar_full_sync_dedicated",
      "Dedicated calendar acknowledgement",
      "calendar",
      "Unmatched events can be deleted"
    ],
    [
      "calendar_full_sync_months",
      "Full Sync age window",
      "calendar",
      "Months of history to maintain"
    ],
    [
      "blueprints",
      "Optional automations",
      "automations",
      "Receipt email, Library, metadata and calendar schedules; install, update and change log"
    ],
    [
      "transfer",
      "Settings transfer",
      "maintenance",
      "Export and import selected settings"
    ],
    [
      "repair",
      "Metadata repair",
      "maintenance",
      "Review cached metadata repairs"
    ],
    [
      "dashboard",
      "Test dashboard",
      "maintenance",
      "Create Home Assistant cards"
    ]
  ].map(([n, e, t, i]) => ({ key: n, label: e, section: t, hint: i })),
  ...ti.map(([n, e]) => ({
    key: `metadata_source_${n}`,
    label: `${e} source`,
    section: "metadata",
    hint: "Preferred metadata source and fallback"
  }))
];
function ns(n, e) {
  const t = (i) => Array.isArray(i) ? JSON.stringify(i) : String(i ?? "");
  return [.../* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(e)])].filter(
    (i) => t(n[i]) !== t(e[i])
  );
}
function Ya(n) {
  const e = n.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return e.length ? js.filter(
    (t) => e.every(
      (i) => `${t.label} ${t.hint} ${t.section} ${t.key}`.toLocaleLowerCase().includes(i)
    )
  ) : [];
}
function Ga(n, e) {
  return a`<div class="switch-row">
      ${P("calendar_full_sync", "Enable Full Sync", "Reconcile a dedicated calendar against completed Journal entries. Unmatched events require repeated successful scans and at least 10 minutes of grace before deletion. Schedule runs in Automations or use Run Full Sync now; enabling this does not create a schedule.")}<input
        type="checkbox"
        role="switch"
        name="calendar_full_sync"
        id="calendar_full_sync"
        aria-describedby="calendar_full_sync-hint"
        .checked=${!!n.calendar_full_sync}
        @change=${(t) => e({ calendar_full_sync: t.target.checked, calendar_full_sync_dedicated: !1 })}
      />
    </div>
    ${n.calendar_full_sync ? a`
            <p class="warning">
              <strong
                >Full Sync requires its own separate calendar. Events in the
                selected age window that do not match a completed database
                Journal entry will be permanently deleted.</strong
              >
            </p>
            <div class="check">
              <input
                type="checkbox"
                name="calendar_full_sync_dedicated"
                id="calendar_full_sync_dedicated"
                aria-describedby="calendar_full_sync_dedicated-hint"
                required
                .checked=${!!n.calendar_full_sync_dedicated}
                @change=${(t) => e({ calendar_full_sync_dedicated: t.target.checked })}
              />${P("calendar_full_sync_dedicated", "I assigned a separate dedicated calendar and understand unmatched events will be deleted.", "Use a calendar reserved for Companion. Full Sync may permanently delete unrelated events within its age window; this acknowledgement resets when you change the destination or toggle Full Sync.")}
            </div>
            <div class="grid settings-grid">
              <div class="setting-field">
                ${P("calendar_full_sync_months", "Full Sync age window · months", "Maintain 1–12 whole months of completed viewings. Older and future events remain outside the window, and recurring events are skipped. Increasing the window makes more events eligible for reconciliation and guarded deletion.")}<input
                  name="calendar_full_sync_months"
                  id="calendar_full_sync_months"
                  aria-describedby="calendar_full_sync_months-hint"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  required
                  .value=${String(n.calendar_full_sync_months ?? 3)}
                  @input=${(t) => e({ calendar_full_sync_months: t.target.value })}
                />
              </div>
            </div>
          ` : l}`;
}
const at = class at extends x {
  constructor() {
    super(...arguments), this.disabled = !1, this.working = !1, this.error = "", this.reviewToken = "", this.generation = 0, this.bound = "";
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    t === this.bound && this.boundClient === this.client || (this.clear(), this.bound = t, this.boundClient = this.client, this.refresh());
  }
  updated(e) {
    e.has("disabled") && e.get("disabled") === !0 && !this.disabled && this.refresh();
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  clear() {
    this.generation++, clearTimeout(this.timer), this.status = void 0, this.pending = void 0, this.working = !1, this.error = "", this.reviewToken = "", this.renderRoot.querySelectorAll("dialog").forEach((e) => e.close());
  }
  confirmNavigation() {
    return !this.working && !this.pending;
  }
  fail(e) {
    g(e) === "unauthorized" ? (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )) : this.error = y(e), this.requestUpdate();
  }
  async refresh() {
    if (!this.client || !this.scope) return;
    const e = this.generation;
    clearTimeout(this.timer);
    try {
      const t = await this.client.calendarStatus(this.scope);
      if (e !== this.generation) return;
      this.status = t, this.error = "", (t.active || t.maintenance?.enabled || t.job && !t.job.finished) && (this.timer = setTimeout(() => {
        this.refresh();
      }, 2e3)), this.requestUpdate();
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  async open() {
    await this.refresh(), !(this.disabled || !this.status?.ready || this.status.active) && (await this.updateComplete, this.renderRoot.querySelector("dialog")?.showModal());
  }
  close(e) {
    e?.preventDefault();
    const t = this.status?.job;
    t && !t.finished && this.client && this.scope && this.client.calendarCancel(this.scope, t.job_id).catch(() => {
    }), this.generation++, clearTimeout(this.timer), this.pending = void 0, this.working = !1, this.error = "", this.requestUpdate(), this.renderRoot.querySelectorAll("dialog").forEach((i) => i.close());
  }
  async start() {
    if (!this.client || !this.scope || this.working || this.disabled || !this.status?.ready)
      return;
    const e = this.generation;
    this.pending ??= this.client.prepareCalendarSync(
      this.scope,
      this.status.fingerprint
    ), this.working = !0, this.error = "", this.requestUpdate();
    try {
      if (await this.client.calendarSync(this.pending), e !== this.generation) return;
      this.pending = void 0, this.renderRoot.querySelector("dialog")?.close(), await this.refresh();
    } catch (t) {
      if (e !== this.generation) return;
      [
        "unauthorized",
        "invalid_request",
        "conflict",
        "busy",
        "not_ready"
      ].includes(g(t)) && (this.pending = void 0), this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.requestUpdate());
    }
  }
  async cancel() {
    if (!this.client || !this.scope || !this.status?.job || this.working)
      return;
    const e = this.generation;
    this.working = !0, this.requestUpdate();
    try {
      await this.client.calendarCancel(this.scope, this.status.job.job_id), e === this.generation && await this.refresh();
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.requestUpdate());
    }
  }
  async maintain(e) {
    if (!this.client || !this.scope || !this.status || this.disabled || this.working)
      return;
    const t = this.generation;
    this.working = !0, this.requestUpdate();
    try {
      if (await this.client.calendarMaintain(
        this.scope,
        e,
        this.status.fingerprint,
        this.reviewToken
      ), t !== this.generation) return;
      this.renderRoot.querySelectorAll("dialog").forEach((i) => i.close()), await this.refresh();
    } catch (i) {
      t === this.generation && this.fail(i);
    } finally {
      t === this.generation && (this.working = !1, this.requestUpdate());
    }
  }
  async requestMaintenance() {
    if (this.disabled || this.working) return;
    const e = this.generation;
    if (await this.refresh(), e !== this.generation || this.error || this.disabled || this.working)
      return;
    const t = this.status?.maintenance;
    !t?.ready || t.active || (t.quarantined || t.uncertain ? (await this.updateComplete, this.renderRoot.querySelector("#maintenance-run")?.showModal()) : await this.maintain("run"));
  }
  renderMaintenance() {
    const e = this.status.maintenance;
    return a`<section aria-label="Full calendar sync">
      <h4>Full Sync</h4>
      <p>
        Uses the saved dedicated calendar and age window. Save settings before
        syncing.
      </p>
      <p role="status">
        ${e.active ? "Syncing…" : "Last successful sync: " + (e.last_success ? new Date(e.last_success).toLocaleString() : "Not yet")}
        · Pending delete: ${e.quarantined} ·
        ${k(e.uncertain, "unconfirmed write")}
      </p>
      ${e.quarantined ? a`<p class="muted">Replaced and unmatched events remain visible until two unchanged scans at least ten minutes apart confirm cleanup. Changes restart this grace period. A forced sync keeps these safeguards.</p>` : l}
      ${Object.keys(e.counts).length ? a`<p class="muted">
              ${Object.entries(e.counts).map(([t, i]) => `${i} ${t.replaceAll("_", " ")}`).join(" · ")}
            </p>` : l}
      ${e.error ? a`<p class="warning">${e.error} ${e.failure_stage ? `Stage: ${e.failure_stage}. Review Full Sync status and the calendar before retrying.` : ""}</p>` : l}
      ${e.ready ? l : a`<p class="warning">The calendar must be available and support event reading, creation and deletion.</p>`}
      <div class="actions">
        <button
          ?disabled=${this.disabled || this.working || e.active || !e.ready}
          @click=${this.requestMaintenance}
        >
          Run Full Sync now
        </button>
        <button ?disabled=${this.working} @click=${this.refresh}>
          Refresh sync status
        </button>
        ${e.uncertain ? a`<button
                ?disabled=${this.disabled || this.working || e.active || !e.ready}
                @click=${() => {
      this.reviewToken = e.review_token ?? "", this.renderRoot.querySelector("dialog")?.showModal();
    }}
              >
                Review unconfirmed writes
              </button>` : l}
      </div>
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      <dialog
        id="maintenance-review"
        class="database-dialog"
        @click=${q}
        @cancel=${this.close}
        aria-labelledby="maintenance-review-title"
      >
        <div class="card-head">
          <h2 id="maintenance-review-title">
            Review unconfirmed calendar writes
          </h2>
          ${S((t) => this.close(t))}
        </div>
        <p>
          Inspect the assigned calendar first. A write may already have
          succeeded. Check again uses reads to recover confirmed results without
          replaying them.
        </p>
        <p class="warning">
          Only after inspecting the calendar, acknowledge these attempts to
          permit new writes. A provider that still hides a successful event
          could produce a duplicate. Unmatched events remain subject to Full
          Sync deletion.
        </p>
        <div class="dialog-footer">
          <button
            ?disabled=${this.working}
            @click=${() => {
      this.close(), this.maintain("run");
    }}
          >
            Check again</button
          ><button
            class="primary"
            ?disabled=${this.working}
            @click=${() => this.maintain("acknowledge")}
          >
            I inspected the calendar · acknowledge
          </button>
        </div>
      </dialog>
      <dialog
        id="maintenance-run"
        class="database-dialog"
        @click=${q}
        @cancel=${this.close}
        aria-labelledby="maintenance-run-title"
      >
        <div class="card-head">
          <h2 id="maintenance-run-title">
            Run Full Sync with pending operations?
          </h2>
          ${S((t) => this.close(t))}
        </div>
        <p>
          Pending delete: ${e.quarantined} ·
          ${k(e.uncertain, "unconfirmed write")}
        </p>
        <p class="warning">
          A forced sync rechecks pending operations. It does not bypass the
          deletion grace period or acknowledge unconfirmed writes. Eligible
          unmatched events on the dedicated calendar may be deleted.
        </p>
        <div class="dialog-footer">
          <button type="button" @click=${() => this.close()}>Cancel</button>
          <button
            type="button"
            class="primary"
            ?disabled=${this.working || this.disabled || e.active || !e.ready}
            @click=${() => this.maintain("run")}
          >
            Continue Full Sync
          </button>
        </div>
      </dialog>
    </section>`;
  }
  render() {
    if (this.status?.maintenance?.enabled) return this.renderMaintenance();
    const e = this.status?.job;
    return a`<section aria-label="Journal calendar export">
      <h4>Export Journal to calendar</h4>
      <p class="muted">
        Uses the saved calendar settings. Save any changes before exporting.
        Only completed Journal viewings are included.
      </p>
      <div class="actions">
        <button
          type="button"
          ?disabled=${this.disabled || this.working || !this.status?.ready || this.status.active}
          @click=${this.open}
        >
          Sync all watched movies to calendar</button
        ><button type="button" ?disabled=${this.working} @click=${this.refresh}>
          Refresh export status</button
        >${this.status?.active ? a`<button type="button" ?disabled=${this.working} @click=${this.cancel}>Cancel export</button>` : l}
      </div>
      ${e ? a`<p role="status">
              ${e.finished ? "Export finished" : "Export in progress"} ·
              ${k(e.total, "viewing")} ·
              ${Object.entries(e.counts).map(([t, i]) => `${i} ${t}`).join(" · ")}
            </p>` : l}
      ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
      <dialog
        class="database-dialog"
        aria-labelledby="calendar-export-title"
        aria-describedby="calendar-export-summary"
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="calendar-export-title">Export Journal to calendar</h2>
          ${S((t) => this.close(t))}
        </div>
        <p id="calendar-export-summary">
          Create events for up to
          ${k(this.status?.completed_viewings ?? 0, "completed viewing")}
          using the saved calendar and templates?
        </p>
        <p>
          Existing events with the same title and start/end times are skipped.
          Changing the title format may result in duplicate events. Descriptions
          on existing events are not updated.
        </p>
        <p class="warning">
          Movie/session details will be shared with the calendar provider and
          anyone who can read the calendar. Failed or uncertain writes require
          review. Cancelling stops unstarted items; created events remain.
        </p>
        ${this.pending ? a`<p role="alert">
                  The start result is unconfirmed. Retry the same request to
                  inspect or resume that job.
                </p>
                <button
                  type="button"
                  ?disabled=${this.working}
                  @click=${async () => {
      window.confirm(
        "Discard this retry and inspect export status? The job may already be running."
      ) && (this.pending = void 0, this.close(), await this.refresh());
    }}
                >
                  Discard retry & inspect
                </button>` : l}
        <div class="dialog-footer">
          <button
            class="primary"
            type="button"
            ?disabled=${this.disabled || this.working || !this.status?.ready}
            @click=${this.start}
          >
            ${this.working ? "Starting…" : this.pending ? "Retry same export" : "Export Journal"}
          </button>
        </div>
      </dialog>
    </section>`;
  }
};
at.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, at.styles = E;
let ii = at;
customElements.get("kaleidescape-calendar-export") || customElements.define("kaleidescape-calendar-export", ii);
const os = [
  [
    "purchase_email",
    "Purchase receipt email",
    "Import receipt HTML from a selected IMAP mailbox.",
    "Choose the IMAP entry, sender filter and fields to import in Home Assistant."
  ],
  [
    "library_schedule",
    "Library sync",
    "Keep the local movie catalog up to date.",
    "Enable and save Library sync, then choose a daily local time in Home Assistant."
  ],
  [
    "metadata_schedule",
    "Metadata refresh",
    "Refresh information from enabled movie providers.",
    "Enable and save your providers, then choose the schedule, providers and Only missing option."
  ],
  [
    "calendar_schedule",
    "Calendar Full Sync",
    "Maintain a dedicated calendar from completed viewings.",
    "Save a dedicated calendar and enable Full Sync first. Unmatched events can be deleted; the schedule includes a later safeguard check."
  ]
], Za = {
  current: "Up to date",
  outdated: "Update available",
  modified: "Modified or unrecognized",
  missing: "Not installed",
  unavailable: "Unable to check"
};
function er(n) {
  const e = n.split(/\r?\n/), t = e.indexOf("# Version history:"), i = e.indexOf("# End version history", t + 1);
  return t < 0 || i < 0 ? [] : e.slice(t + 1, i).filter((s) => /^# v\d+: /.test(s)).map((s) => s.slice(2));
}
const rt = class rt extends x {
  constructor() {
    super(...arguments), this.versionsOnly = !1, this.disabled = !1, this.busy = !1, this.message = "", this.error = "", this.checking = !1, this.generation = 0, this.reviewRequest = 0;
  }
  willUpdate(e) {
    (e.has("client") || e.has("scope")) && (this.reset(), this.client && this.scope?.permissions.edit && this.refresh());
  }
  disconnectedCallback() {
    this.reset(), super.disconnectedCallback();
  }
  reset() {
    this.generation++, this.setBusy(!1), this.message = this.error = "", this.checking = !1, this.statuses = void 0, this.closeReview();
  }
  confirmNavigation() {
    return !this.busy;
  }
  setBusy(e) {
    e !== this.busy && (this.busy = e, this.dispatchEvent(
      new CustomEvent("blueprint-busy", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    ));
  }
  closeReview(e) {
    if (this.busy) {
      e?.preventDefault();
      return;
    }
    this.reviewRequest++, this.review = void 0, this.renderRoot.querySelector("dialog")?.close(), this.opener?.focus(), this.opener = void 0, this.requestUpdate();
  }
  fail(e) {
    g(e) === "unauthorized" ? (this.reset(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )) : this.error = y(e);
  }
  async refresh() {
    if (!this.client || !this.scope?.permissions.edit || this.checking) return;
    const e = this.generation;
    this.checking = !0, this.requestUpdate();
    try {
      const t = await this.client.automationStatuses(this.scope);
      e === this.generation && (this.statuses = t);
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.checking = !1, this.requestUpdate());
    }
  }
  async openReview(e, t, i, s) {
    if (!this.client || !this.scope?.permissions.edit || this.busy || this.disabled && i !== "history")
      return;
    const r = this.client, o = this.scope, d = this.generation, c = ++this.reviewRequest, h = this.statuses?.[e];
    this.opener = s?.currentTarget ?? this.opener, this.review = {
      kind: e,
      label: t,
      mode: i,
      revision: h?.revision ?? null,
      installed: h?.installed_version ?? null,
      bundled: h?.latest_version,
      modified: h?.status === "modified",
      loading: !0,
      entries: []
    }, this.error = this.message = "", this.requestUpdate(), await this.updateComplete;
    const u = () => this.isConnected && c === this.reviewRequest && d === this.generation && this.client === r && this.scope === o && !!o.permissions.edit;
    if (!u()) return;
    const p = this.renderRoot.querySelector("dialog");
    p && !p.open && p.showModal();
    try {
      const m = await r.automationTemplate(o, e);
      if (!u()) return;
      this.review = {
        ...this.review,
        loading: !1,
        entries: er(m.yaml),
        template: m
      };
    } catch (m) {
      if (!u()) return;
      g(m) === "unauthorized" ? this.fail(m) : this.review = {
        ...this.review,
        loading: !1,
        error: y(m)
      };
    }
    this.requestUpdate();
  }
  async applyReview() {
    const e = this.review;
    if (!this.client || !this.scope?.permissions.edit || this.disabled || this.busy || !e?.template || e.loading || e.error || e.mode === "history" || e.mode === "update" && !e.revision)
      return;
    const t = this.client, i = this.scope, s = this.generation, r = () => this.isConnected && s === this.generation && this.client === t && this.scope === i && !!i.permissions.edit;
    this.setBusy(!0), this.message = this.error = "", this.requestUpdate();
    try {
      if (e.mode === "update" ? await t.updateAutomationBlueprint(
        i,
        e.kind,
        e.revision
      ) : await t.installAutomationBlueprint(
        e.template.path,
        e.template.yaml
      ), !r()) return;
      this.message = `${e.label} blueprint ${e.mode === "update" ? "updated" : "installed"}. Open Home Assistant Blueprints to create or review its automations.`;
    } catch (o) {
      if (!r()) return;
      g(o) === "already_exists" ? this.message = `${e.label} was installed while you were reviewing. Existing contents were preserved; check its refreshed status.` : this.fail(o);
    } finally {
      r() && (this.setBusy(!1), this.closeReview(), await this.refresh(), this.requestUpdate());
    }
  }
  renderReview() {
    const e = this.review, t = e?.mode === "update" && !e.modified && e.installed != null ? e.entries.filter(
      (i) => Number(/^v(\d+):/.exec(i)?.[1]) > e.installed
    ) : e?.entries ?? [];
    return a`<dialog
      class="blueprint-review"
      aria-labelledby="blueprint-review-title"
      @click=${q}
      @cancel=${(i) => {
      this.busy && i.preventDefault();
    }}
      @close=${this.closeReview}
    >
      <div class="card-head">
        <h2 id="blueprint-review-title">
          ${e?.label} ·
          ${e?.mode === "history" ? "change log" : e?.mode === "install" ? "Install blueprint" : "Review update"}
        </h2>
        ${S((i) => this.closeReview(i), this.busy)}
      </div>
      <p>${os.find(([i]) => i === e?.kind)?.[3]}</p>
      <div class="review-versions">
        <span
          >Installed:
          <strong
            >${e?.mode === "install" ? "Not installed" : e?.installed != null ? `v${e.installed}` : "Unversioned"}</strong
          ></span
        ><span
          >Bundled:
          <strong
            >${e?.bundled != null ? `v${e.bundled}` : "Unknown"}</strong
          ></span
        >
      </div>
      ${e?.mode === "update" ? a`<p class=${e.modified ? "warning" : "settings-note"}>${e.modified ? "This file is modified or unrecognized. Replacing it may discard local edits." : "This update replaces the installed blueprint."} Dependent automations are reloaded. Your automation inputs remain managed in Home Assistant.</p>` : e?.mode === "install" ? a`<p class="settings-note">Installing adds the blueprint template. It does not create or enable an automation. Existing blueprint files are preserved.</p>` : a`<p class="muted">History bundled with Companion; this does not describe local edits.</p>`}
      <h3>
        ${e?.mode === "update" && !e.modified && e.installed != null ? `Changes since v${e.installed}` : "Version history"}
      </h3>
      ${e?.loading ? a`<p role="status">Loading change log…</p>` : e?.error ? a`<p role="alert" class="error">${e.error}</p>
                <button
                  type="button"
                  @click=${() => this.openReview(e.kind, e.label, e.mode)}
                >
                  Retry change log
                </button>` : t.length ? a`<ul class="history-list">
                  ${t.map((i) => a`<li>${i}</li>`)}
                </ul>` : a`<p>
                  No change log entries are available for this version.
                </p>`}
      ${e && t.length !== e.entries.length && !e.loading ? a`<details class="setting-help">
              <summary>Full bundled history</summary>
              <ul class="history-list">
                ${e.entries.map((i) => a`<li>${i}</li>`)}
              </ul>
            </details>` : l}
      <div class="dialog-footer">
        <button type="button" ?disabled=${this.busy} @click=${this.closeReview}>
          ${e?.mode === "history" ? "Close" : "Cancel"}</button
        >${e && e.mode !== "history" ? a`<button type="button" class="primary" ?disabled=${this.disabled || this.busy || e.loading || !!e.error || !e.template || e.mode === "update" && !e.revision} @click=${this.applyReview}>${this.busy ? "Applying…" : e.mode === "install" ? "Install blueprint" : "Update installed blueprint"}</button>` : l}
      </div>
    </dialog>`;
  }
  render() {
    return this.scope?.permissions.edit ? a`<section aria-label="Optional automations">
      ${this.versionsOnly ? l : a`<div class="settings-card">
              <div class="section-heading">
                <div>
                  <h3>Optional automations</h3>
                  <p>
                    Blueprints are reusable templates. Installation and running
                    an automation are separate steps.
                  </p>
                </div>
                <span class="scope-tag">Explicit actions</span>
              </div>
              <ol class="workflow">
                <li>
                  <strong>Install or update</strong
                  ><small>Review the version and change log here.</small>
                </li>
                <li>
                  <strong>Create in Home Assistant</strong
                  ><small>Choose the blueprint and its inputs.</small>
                </li>
                <li>
                  <strong>Enable & verify</strong
                  ><small>Review the schedule and automation trace.</small>
                </li>
              </ol>
            </div>`}
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Automation blueprint versions</h3>
            <p>
              Compare installed templates with this Companion build. Bundled
              versions are not a remote release check.
            </p>
          </div>
          <button
            type="button"
            ?disabled=${this.checking || this.busy || !!this.review}
            @click=${this.refresh}
          >
            ${this.checking ? "Checking…" : "Check again"}
          </button>
        </div>
        ${this.checking && !this.statuses ? a`<p role="status">Checking blueprints…</p>` : l}
        ${this.statuses ? a`<div
                class="blueprint-table-wrap"
                tabindex="0"
                role="region"
                aria-label="Blueprint versions and actions"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Blueprint</th>
                      <th scope="col">Installed</th>
                      <th scope="col">Bundled</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${os.map(([e, t, i]) => {
      const s = this.statuses?.[e], r = s?.status ?? "unavailable";
      return a`<tr data-blueprint=${e}>
                        <td>
                          <strong>${t}</strong><small>${i}</small>
                        </td>
                        <td>
                          ${r === "missing" ? "Not installed" : r === "unavailable" ? "Unknown" : s?.installed_version != null ? `v${s.installed_version}` : "Unversioned"}
                        </td>
                        <td>
                          ${s?.latest_version != null ? `v${s.latest_version}` : "Unknown"}
                        </td>
                        <td>
                          <span class=${`status ${r}`}
                            >${Za[r]}</span
                          >
                        </td>
                        <td>
                          <div class="row-actions">
                            ${!this.versionsOnly && (r === "outdated" || r === "modified" || r === "missing") ? a`<button type="button" class=${r === "outdated" ? "primary" : ""} ?disabled=${this.disabled || this.busy} @click=${(o) => this.openReview(e, t, r === "missing" ? "install" : "update", o)}>${r === "missing" ? "Install" : r === "modified" ? "Review replacement" : "Update"}</button>` : l}
                            <button
                              type="button"
                              class="link"
                              ?disabled=${this.busy}
                              aria-label=${`View ${t} change log`}
                              @click=${(o) => this.openReview(e, t, "history", o)}
                            >
                              View change log
                            </button>
                            ${!this.versionsOnly && r === "current" ? a`<a href="/config/blueprint/dashboard">Create automation ↗</a>` : l}
                          </div>
                        </td>
                      </tr>`;
    })}
                  </tbody>
                </table>
              </div>` : l}
        ${this.message ? a`<p class="settings-note" role="status">${this.message}</p>` : l}${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        <details class="setting-help">
          <summary>Installation, local changes & troubleshooting</summary>
          <p>
            Companion installs missing blueprints automatically when Home
            Assistant's automation integration is available. Existing files are
            never replaced automatically. Versions on modified files are
            self-reported. If status is unavailable, check that automations are
            enabled and the file is readable. After an unconfirmed update,
            inspect the installed file and automation state before retrying.
          </p>
          <a href="/config/blueprint/dashboard"
            >Open Home Assistant Blueprints</a
          >
        </details>
      </div>
      ${this.renderReview()}
    </section>` : l;
  }
};
rt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  versionsOnly: { type: Boolean },
  disabled: { type: Boolean }
}, rt.styles = [
  E,
  qi,
  C`
      .blueprint-table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
      }
      td {
        vertical-align: top;
        padding: 18px 12px;
        border-bottom: 1px solid var(--line);
      }
      td:first-child {
        min-width: 180px;
      }
      td small {
        display: block;
        margin-top: 5px;
        max-width: 30ch;
      }
      .row-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        min-width: 145px;
      }
      .row-actions button {
        font-size: 12px;
      }
      .status {
        font-size: 12px;
        display: inline-block;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 4px 7px;
      }
      .status.current {
        color: var(--accent);
      }
      .status.outdated,
      .status.modified {
        color: var(--warning-color, #8b5c00);
      }
      .workflow {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        padding-left: 20px;
        margin: 18px 0 0;
      }
      .workflow li {
        padding-inline-end: 10px;
        font-size: 14px;
      }
      .workflow small {
        display: block;
        margin-top: 5px;
      }
      .blueprint-review {
        width: min(680px, calc(100% - 24px));
      }
      .review-versions {
        display: flex;
        gap: 16px;
        padding: 14px 0;
        flex-wrap: wrap;
      }
      .review-versions span {
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .history-list {
        padding-left: 22px;
        font-size: 14px;
        line-height: 1.6;
      }
      .history-list li {
        padding: 7px 0;
      }
      @media (max-width: 600px) {
        .workflow {
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }
      }
    `
];
let si = rt;
customElements.get("kaleidescape-automation-blueprints") || customElements.define(
  "kaleidescape-automation-blueprints",
  si
);
const tr = [
  ["rules", "Runtime rules and feature enablement"],
  ["browsing", "Personal browsing preferences · may include searches/names"],
  ["shared", "Shared hidden collection names"],
  ["connections", "Network addresses, player and HA entity choices · private"],
  ["templates", "Custom calendar text templates · private"]
], nt = class nt extends x {
  constructor() {
    super(...arguments), this.disabled = !1, this.generation = 0, this.selected = /* @__PURE__ */ new Set(["rules", "browsing"]), this.request = "", this.busy = !1, this.pending = !1, this.error = "", this.notice = "";
  }
  willUpdate(e) {
    (e.has("client") || e.has("scope")) && this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.reset();
  }
  reset() {
    this.generation++, this.artifact = this.preview = void 0, this.request = "", this.busy = this.pending = !1, this.error = this.notice = "", this.renderRoot.querySelector("dialog")?.close();
  }
  close(e) {
    e?.preventDefault(), this.reset(), this.requestUpdate();
  }
  fail(e) {
    this.error = y(e), g(e) === "unauthorized" && (this.reset(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async file(e) {
    const t = e.target.files?.[0], i = this.generation;
    this.artifact = this.preview = void 0, this.error = "";
    try {
      if (!t || t.size > 262144) throw new Error("Invalid settings file");
      const s = JSON.parse(await t.text());
      if (i !== this.generation) return;
      if (!s || typeof s != "object" || Array.isArray(s))
        throw new Error("Invalid settings file");
      this.artifact = s;
    } catch {
      i === this.generation && (this.error = "Choose a settings JSON file, at most 256 KiB.");
    }
    this.requestUpdate();
  }
  async run(e) {
    if (!this.client || !this.scope || this.busy || !this.selected.size) return;
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      e === "apply" && (this.request ||= ie(), this.pending = !0);
      const i = await this.client.settingsTransfer(
        this.scope,
        e,
        [...this.selected],
        this.artifact,
        this.request
      );
      if (t !== this.generation) return;
      if (e === "export") {
        const s = URL.createObjectURL(
          new Blob([JSON.stringify(i, null, 2)], {
            type: "application/json"
          })
        ), r = document.createElement("a");
        r.href = s, r.download = "companion-settings.json", r.click(), setTimeout(() => URL.revokeObjectURL(s), 1e3);
      } else e === "preview" ? this.preview = i : (this.pending = !1, this.request = "", this.dispatchEvent(
        new CustomEvent("settings-imported", {
          detail: i.patch ?? {},
          bubbles: !0,
          composed: !0
        })
      ), this.preview = void 0, this.notice = "Browsing/shared choices applied. Runtime changes are staged below: review and click Save settings. Full Sync requires a fresh dedicated-calendar acknowledgement.", this.renderRoot.querySelector("dialog")?.close());
    } catch (i) {
      t === this.generation && this.fail(i);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  render() {
    if (!this.scope?.permissions.edit) return l;
    const e = this.busy || this.disabled || this.pending;
    return a`<button
        type="button"
        ?disabled=${this.disabled || this.busy}
        @click=${() => this.renderRoot.querySelector("dialog")?.showModal()}
      >
        Export / import settings
      </button>
      ${this.notice ? a`<p class="notice" role="status">${this.notice}</p>` : l}
      <dialog
        class="database-dialog"
        @click=${q}
        @cancel=${(t) => this.close(t)}
      >
        <div class="card-head">
          <h2>Export / import settings</h2>
          ${S(() => this.close())}
        </div>
        <p>
          Choose the categories to transfer. Credentials are always excluded.
          Connection choices, searches, names and templates can contain private
          information; protect the downloaded file.
        </p>
        ${tr.map(
      ([t, i]) => a`<label class="check"
              ><input
                type="checkbox"
                .checked=${this.selected.has(t)}
                ?disabled=${e}
                @change=${(s) => {
        s.target.checked ? this.selected.add(t) : this.selected.delete(t), this.preview = void 0, this.requestUpdate();
      }}
              />
              ${i}</label
            >`
    )}
        <div class="actions">
          <button
            type="button"
            ?disabled=${e || !this.selected.size}
            @click=${() => this.run("export")}
          >
            Export selected
          </button>
        </div>
        <label
          >Import settings JSON<input
            type="file"
            accept=".json,application/json"
            ?disabled=${e}
            @change=${this.file}
        /></label>
        <button
          type="button"
          ?disabled=${e || !this.artifact || !this.selected.size}
          @click=${() => this.run("preview")}
        >
          Review selected categories
        </button>
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.preview ? a`<h3>Review import</h3>
                <p>
                  Applying updates personal/shared settings immediately. Runtime
                  fields are staged on the Settings page for validation and Save
                  settings. Credentials and database contents are unaffected.
                </p>
                <div style="max-height:35vh;overflow:auto">
                  ${Object.entries(this.preview.categories).map(
      ([t, i]) => a`<details>
                        <summary>
                          ${t} · ${Object.keys(i).length} fields
                        </summary>
                        <pre
                          style="white-space:pre-wrap;overflow-wrap:anywhere"
                        >
${JSON.stringify(i, null, 2)}</pre>
                      </details>`
    )}
                </div>` : l}
        ${this.pending && !this.busy ? a`<p class="warning">Result unconfirmed. Retry the same import before changing the selection.</p>` : l}
        <div class="dialog-footer">
          <button
            type="button"
            class="primary"
            ?disabled=${this.busy || !this.preview}
            @click=${() => this.run("apply")}
          >
            ${this.pending ? "Retry same import" : "Apply selected settings"}
          </button>
        </div>
      </dialog>`;
  }
};
nt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, nt.styles = E;
let ai = nt;
customElements.get("kaleidescape-settings-transfer") || customElements.define(
  "kaleidescape-settings-transfer",
  ai
);
function ee(n) {
  return Array.isArray(n) ? `[${n.map(ee).join(",")}]` : n && typeof n == "object" ? `{${Object.entries(n).sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => `${JSON.stringify(e)}:${ee(t)}`).join(",")}}` : JSON.stringify(n);
}
class B extends Error {
}
class ir {
  constructor(e, t) {
    if (this.client = e, this.plan = t, this.attempted = !1, this.created = !1, !/^companion-test-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      t.url_path
    ) || new TextEncoder().encode(t.yaml).length > 262144)
      throw new B("Invalid generated dashboard artifact");
  }
  async install(e) {
    const t = () => {
      if (!e())
        throw new B(
          "Dashboard setup stopped because the HA account or dataset changed."
        );
    }, i = await this.client.haDashboards();
    t();
    const s = i.find(
      (d) => d.url_path === this.plan.url_path
    );
    if (s && (!this.attempted || s.title !== this.plan.title || s.mode !== "storage" || s.icon !== "mdi:test-tube" || s.require_admin !== !1 || s.show_in_sidebar !== !0))
      throw new B(
        "The dashboard URL already exists or its settings changed. Existing dashboards are never replaced."
      );
    if (!s) {
      if (this.created)
        throw new B(
          "The newly created dashboard was removed. Start a new generation request."
        );
      if (this.attempted)
        throw new B(
          "Creation was already attempted, but HA has not exposed the result. Wait and check again or inspect Dashboards; no second create was sent."
        );
      this.attempted = !0, await this.client.createHATestDashboard(this.plan), t(), this.created = !0;
    }
    let r;
    try {
      r = await this.client.haTestDashboardConfig(this.plan.url_path), t();
    } catch (d) {
      if (t(), g(d) !== "config_not_found") throw d;
    }
    if (r) {
      if (ee(r) === ee(this.plan.config)) return;
      throw new B(
        "This dashboard already contains different content. It was not overwritten. Inspect it in HA dashboard settings."
      );
    }
    if (!this.created && !s)
      throw new B("Could not verify the new dashboard");
    await this.client.saveHATestDashboard(this.plan), t();
    const o = await this.client.haTestDashboardConfig(
      this.plan.url_path
    );
    if (t(), ee(o) !== ee(this.plan.config))
      throw new B(
        "The saved dashboard could not be verified. Inspect it before continuing."
      );
  }
}
const ot = class ot extends x {
  constructor() {
    super(...arguments), this.disabled = !1, this.name = "Kaleidescape test guide", this.request = "", this.generation = 0, this.busy = !1, this.pending = !1, this.complete = !1, this.error = "", this.bound = "";
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.permissions.edit}`;
    t === this.bound && this.client === this.boundClient || (this.reset(), this.bound = t, this.boundClient = this.client);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.reset();
  }
  reset() {
    this.generation++, this.plan = void 0, this.installer = void 0, this.busy = this.pending = this.complete = !1, this.error = this.request = "", this.renderRoot?.querySelector("dialog")?.close(), this.signal();
  }
  signal() {
    this.dispatchEvent(
      new CustomEvent("dashboard-busy", {
        detail: this.busy || this.pending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  confirmNavigation() {
    return !(this.busy || this.pending && !window.confirm(
      "Dashboard setup is unconfirmed. It may already exist in HA. Leave setup and inspect Dashboards before creating another?"
    ));
  }
  close(e) {
    e?.preventDefault(), this.busy || this.pending ? (this.reset(), this.requestUpdate()) : this.renderRoot.querySelector("dialog")?.close();
  }
  async create(e) {
    if (e?.preventDefault(), e?.stopPropagation(), !this.client || !this.scope?.permissions.edit || this.busy || this.complete || this.disabled && !this.plan)
      return;
    const t = this.generation, i = () => t === this.generation && this.isConnected;
    this.busy = !0, this.error = "", this.signal(), this.requestUpdate();
    try {
      if (this.request ||= ie(), !this.plan) {
        const s = await this.client.testDashboard(
          this.scope,
          this.request,
          this.name.trim()
        );
        if (!i()) return;
        this.installer = new ir(this.client, s), this.plan = s;
      }
      if (this.pending = !0, await this.installer.install(i), !i() || (await this.client.verifyTestDashboard(this.scope, this.request), !i())) return;
      this.complete = !0, this.pending = !1;
    } catch (s) {
      if (!i()) return;
      const r = g(s), o = s?.message;
      this.error = typeof o == "string" && (r.startsWith("dashboard_") || s instanceof B) ? o : y(s), r === "unauthorized" && (this.reset(), this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      ));
    } finally {
      i() && (this.busy = !1, this.signal(), this.requestUpdate());
    }
  }
  download() {
    if (!this.plan) return;
    const e = URL.createObjectURL(
      new Blob([this.plan.yaml], { type: "application/yaml" })
    ), t = document.createElement("a");
    t.href = e, t.download = "kaleidescape-test-dashboard.yaml", document.body.append(t), t.click(), t.remove(), setTimeout(() => URL.revokeObjectURL(e), 1e3);
  }
  render() {
    return this.scope?.permissions.edit ? a`<section>
        <h3>Test dashboard and usage guide</h3>
        <p>
          Generate seven focused views with card examples and expected behavior,
          using saved Companion settings. Save any settings changes first.
          Requires a synced Library, configured player controls, a Now Playing
          source and Journal data.
        </p>
        <button
          type="button"
          ?disabled=${this.disabled || this.busy}
          @click=${() => this.renderRoot.querySelector("dialog")?.showModal()}
        >
          Generate test dashboard
        </button>
      </section>
      <dialog
        data-admin-dialog
        class="database-dialog"
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>Generate test dashboard</h2>
          ${S((e) => this.close(e))}
        </div>
        <p>
          Creates a separate HA-managed dashboard visible to household users,
          with an editable configuration and downloadable YAML. Existing
          dashboards are never replaced. No player commands, scans or scrapes
          run during creation.
        </p>
        <form @submit=${this.create}>
          <label
            >Dashboard name<input
              name="dashboard_name"
              type="text"
              maxlength="80"
              required
              .value=${this.name}
              ?disabled=${this.busy || !!this.plan}
              @input=${(e) => {
      this.name = e.target.value;
    }}
          /></label>
          ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
          ${this.pending ? a`<p class="warning">Setup is unconfirmed. Retry checks the same unique dashboard before writing. Changed dashboard content is never overwritten; failed setup does not delete anything.</p>` : l}
          ${this.plan ? a`<p>Views: ${this.plan.views.join(" · ")}</p>
                  <div class="actions">
                    <a
                      href=${`/${this.plan.url_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      >Open test dashboard</a
                    ><button type="button" @click=${this.download}>
                      Download YAML
                    </button>
                  </div>` : l}
          ${this.complete ? a`<p role="status">Test dashboard created and verified. Open it to follow the test cases.</p>` : l}
          <div class="dialog-footer">
            ${this.complete ? a`<button
                    type="button"
                    @click=${() => {
      this.reset(), this.requestUpdate();
    }}
                  >
                    Create another guide
                  </button>` : a`<button
                    class="primary"
                    type="submit"
                    ?disabled=${this.busy || this.disabled && !this.plan}
                  >
                    ${this.busy ? "Creating…" : this.pending ? "Check and finish setup" : "Create test dashboard"}
                  </button>`}
          </div>
        </form>
      </dialog>` : l;
  }
};
ot.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, ot.styles = E;
let ri = ot;
customElements.get("kaleidescape-test-dashboard") || customElements.define("kaleidescape-test-dashboard", ri);
const lt = class lt extends x {
  constructor() {
    super(...arguments), this.disabled = !1, this.working = !1, this.error = "", this.generation = 0, this.bound = "";
  }
  willUpdate(e) {
    if (!e.has("scope") && !e.has("client")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    t === this.bound && this.boundClient === this.client || (this.clear(), this.bound = t, this.boundClient = this.client);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear();
  }
  clear() {
    this.generation++, this.review = this.result = this.pending = void 0, this.working = !1, this.error = "", this.renderRoot.querySelector("dialog")?.close();
  }
  confirmNavigation() {
    return !this.working && !this.pending;
  }
  close(e) {
    e?.preventDefault(), this.clear(), this.requestUpdate();
  }
  fail(e) {
    g(e) === "unauthorized" ? (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )) : this.error = y(e), this.requestUpdate();
  }
  async open() {
    if (!this.client || !this.scope || this.disabled || this.working) return;
    if (this.pending) {
      this.renderRoot.querySelector("dialog")?.showModal();
      return;
    }
    const e = this.generation;
    this.working = !0, this.error = "", this.requestUpdate();
    try {
      const t = await this.client.metadataPreview(this.scope);
      if (e !== this.generation) return;
      this.review = t, this.requestUpdate(), await this.updateComplete, e === this.generation && this.renderRoot.querySelector("dialog")?.showModal();
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.requestUpdate());
    }
  }
  async repair() {
    if (!this.client || !this.scope || !this.review || this.disabled || this.working)
      return;
    const e = this.generation;
    this.working = !0, this.error = "", this.requestUpdate();
    try {
      this.pending ??= this.client.prepareMetadataRepair(
        this.scope,
        this.review.token
      );
      const t = await this.client.repairMetadata(this.pending);
      if (e !== this.generation) return;
      this.result = t, this.pending = void 0, this.renderRoot.querySelector("dialog")?.close();
    } catch (t) {
      if (e !== this.generation) return;
      [
        "conflict",
        "invalid_request",
        "busy",
        "not_ready",
        "backup_in_progress",
        "library_disabled",
        "repair_limit"
      ].includes(g(t)) && (this.pending = void 0, this.review = void 0), this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.requestUpdate());
    }
  }
  render() {
    const e = this.review;
    return a`<section aria-label="Journal metadata repair">
      <h4>Journal Library metadata</h4>
      <p class="muted">
        Fill missing movie details in existing Journal entries from the saved
        Library cache. Existing values, viewing times and calendar events stay
        unchanged.
      </p>
      <button
        type="button"
        ?disabled=${this.disabled || this.working}
        @click=${this.open}
      >
        ${this.working ? "Checking…" : "Repair Journal Library metadata"}
      </button>
      ${this.result ? a`<p role="status">Updated ${k(this.result.updated_count, "entry", "entries")} · ${this.result.unmatched_count} unmatched · ${this.result.active_count} active and skipped.</p>` : l}
      ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
      <dialog
        class="database-dialog"
        aria-labelledby="metadata-repair-title"
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="metadata-repair-title">Repair Journal Library metadata</h2>
          ${S((t) => this.close(t))}
        </div>
        ${e ? a`<p>${k(e.updated_count, "entry", "entries")} with missing details can be updated. ${e.unchanged_count} already up to date · ${e.unmatched_count} unmatched · ${e.active_count} active and skipped.</p>` : l}
        <p>
          Matches use version identifiers in the configured Library, including
          recognized playback handles. Movie names are never guessed. Existing
          metadata is preserved. Entries with open sessions are skipped.
        </p>
        <p>
          Existing calendar events are not edited or recreated. Sync the Library
          first if its details need refreshing.
        </p>
        ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
        ${this.pending ? a`<p role="alert">
                  The result is unconfirmed. Retry the same repair to retrieve
                  its result.
                </p>
                <button
                  type="button"
                  ?disabled=${this.working}
                  @click=${() => {
      window.confirm(
        "Discard this retry? The repair may already have committed. Review again to check current metadata."
      ) && (this.pending = void 0, this.close(), this.requestUpdate());
    }}
                >
                  Discard retry & review again
                </button>` : l}
        <div class="dialog-footer">
          <button
            class="primary"
            type="button"
            ?disabled=${this.disabled || this.working || !e?.updated_count}
            @click=${this.repair}
          >
            ${this.working ? "Repairing…" : this.pending ? "Retry same repair" : "Repair missing metadata"}
          </button>
        </div>
      </dialog>
    </section>`;
  }
};
lt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, lt.styles = E;
let ni = lt;
customElements.get("kaleidescape-metadata-repair") || customElements.define("kaleidescape-metadata-repair", ni);
const dt = class dt extends x {
  constructor() {
    super(...arguments), this.draft = {}, this.disabled = !1, this.actionsDisabled = !1, this.credentialConfigured = !1, this.generation = 0, this.bound = "", this.error = "", this.loading = !1;
  }
  willUpdate(e) {
    if (e.has("client") || e.has("scope")) {
      const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${!!this.scope?.permissions.edit}`;
      if (t === this.bound && this.client === this.boundClient) return;
      this.bound = t, this.boundClient = this.client, this.loading = !1, this.generation++, clearTimeout(this.timer), this.status = void 0, this.error = "";
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.generation++, clearTimeout(this.timer);
  }
  change(e, t) {
    this.disabled || this.dispatchEvent(
      new CustomEvent("metadata-settings", {
        detail: { [e]: t },
        bubbles: !0,
        composed: !0
      })
    );
  }
  async refresh(e = !1) {
    if (this.loading || !this.scope?.permissions.edit || !this.client || e && (this.disabled || this.actionsDisabled || !this.scope.library_enabled))
      return;
    this.loading = !0, clearTimeout(this.timer), this.requestUpdate();
    const t = this.generation;
    try {
      const i = await this.client.metadataStatus(this.scope, e);
      if (t !== this.generation) return;
      this.status = i, this.error = "", i.running && (this.timer = setTimeout(() => {
        this.refresh();
      }, 2e3));
    } catch (i) {
      t === this.generation && (this.error = y(i));
    } finally {
      t === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  toggle(e, t, i) {
    return a`<div class="switch-row">
      ${P(e, t, i)}<input
        name=${e}
        id=${e}
        aria-describedby=${`${e}-hint`}
        type="checkbox"
        role="switch"
        .checked=${!!this.draft[e]}
        ?disabled=${this.disabled}
        @change=${(s) => this.change(e, s.target.checked)}
      />
    </div>`;
  }
  render() {
    return this.scope?.permissions.edit ? a`<section aria-label="External metadata">
      <p class="settings-note">
        Internet lookups share movie titles and release years with enabled
        providers. Store lookups may use existing purchase links; prices and
        order IDs are not sent. Save settings before refreshing.
      </p>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Kaleidescape Store</h3>
            <p>Public movie metadata and Rotten Tomatoes scores.</p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        ${this.toggle("metadata_store_enabled", "Enable Kaleidescape Store", "Experimental public Store lookups. No account or Store credential is required.")}
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>TMDB</h3>
            <p>Additional credits, descriptions, ratings and images.</p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        ${this.toggle("metadata_tmdb_enabled", "Enable TMDB", "Use your TMDB API credential for optional metadata requests.")}
        <div class="credential-row spaced">
          <div class="setting-field">
            ${P("metadata_tmdb_credential", "TMDB API key or API Read Access Token", "Use an API key or API Read Access Token from your TMDB account's API settings. Leave blank to keep a saved credential; enter a new value to replace it when you save. Saved secrets are never displayed or included in settings exports.")}<input
              name="metadata_tmdb_credential"
              id="metadata_tmdb_credential"
              aria-describedby="metadata_tmdb_credential-hint"
              type="password"
              autocomplete="new-password"
              maxlength="1024"
              placeholder=${this.credentialConfigured ? "Leave blank to keep your saved credential" : "Enter an API key or read access token"}
              .value=${String(this.draft.metadata_tmdb_credential ?? "")}
              ?disabled=${this.disabled || !!this.draft.metadata_clear_tmdb_key}
              @input=${(e) => this.change("metadata_tmdb_credential", e.target.value)}
            />
          </div>
          <span class="credential-actions"
            ><button
              type="button"
              name="metadata_clear_tmdb_key"
              id="metadata_clear_tmdb_key"
              class=${this.draft.metadata_clear_tmdb_key ? "" : "danger"}
              aria-describedby="metadata_clear_tmdb_key-hint"
              ?disabled=${this.disabled || !this.credentialConfigured && !this.draft.metadata_tmdb_credential && !this.draft.metadata_clear_tmdb_key}
              @click=${() => this.change("metadata_clear_tmdb_key", !this.draft.metadata_clear_tmdb_key)}
            >
              ${this.draft.metadata_clear_tmdb_key ? "Undo" : "Remove"}
            </button>
            ${Si("Remove TMDB credential", "Stage removal of the stored credential. Save settings to apply it, or choose Undo to keep it. Removal takes precedence over any replacement entered here.")}
            <span class="setting-description" id="metadata_clear_tmdb_key-hint"
              >Removal is applied only when you save settings; Undo cancels the
              removal.</span
            ></span
          >
        </div>
        <p class="muted" role="status">
          ${this.draft.metadata_clear_tmdb_key ? "Credential removal pending. Save settings to apply, or Undo to keep it." : this.credentialConfigured ? "A credential is saved." : "No credential is saved."}
        </p>
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Preferred sources</h3>
            <p>
              Choose the default source for each movie field. Per-movie edits
              and reviewed choices take priority.
            </p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        <details class="field-sources" open>
          <summary>Field mapping</summary>
          <p class="muted">
            Automatic uses the available cached sources. A preferred provider
            falls back when a value is missing; Original library data uses only
            the scanned field. These choices do not enable a provider.
          </p>
          <button
            type="button"
            ?disabled=${this.disabled || !this.draft.metadata_tmdb_enabled}
            @click=${() => {
      const e = Object.fromEntries(
        ti.map(([t, , i]) => [
          "metadata_source_" + t,
          t === "artwork" || t === "critic_score" || t === "audience_score" || t === "distributor" ? "kaleidescape" : i.some((s) => s === "tmdb") ? "tmdb" : "auto"
        ])
      );
      this.dispatchEvent(
        new CustomEvent("metadata-settings", {
          detail: e,
          bubbles: !0,
          composed: !0
        })
      );
    }}
          >
            Prefer TMDB · keep Kaleidescape covers and RT scores
          </button>
          <div class="grid settings-grid spaced">
            ${ti.map(([e, t, i]) => {
      const s = "metadata_source_" + e, r = String(this.draft[s] ?? "auto"), o = e === "artwork" ? "Choose the preferred portrait cover. Kaleidescape uses the edition artwork cached from your system; TMDB downloads covers on metadata refresh when Cover artwork sync is enabled. Per-movie choices take priority." : e === "backdrop" ? "Choose the source for landscape images. TMDB is the available provider; enable TMDB and Cover artwork sync for new downloads. Existing cached images remain usable." : `Choose the preferred source for ${t.toLowerCase()}. Automatic uses available cached sources; a preferred provider falls back when its value is missing. Original library data uses only the scanned field. This does not enable providers or override reviewed per-movie choices.`;
      return a`<div class="setting-field">
                ${P(s, t, o)}<select
                  name=${s}
                  id=${s}
                  aria-describedby=${`${s}-hint`}
                  .value=${r}
                  ?disabled=${this.disabled}
                  @change=${(d) => this.change(s, d.target.value)}
                >
                  ${["auto", "original", ...i].map((d) => a`<option value=${d} ?selected=${d === r}>${e === "artwork" && d === "kaleidescape" ? "Kaleidescape library cover" : Wa[d]}</option>`)}
                </select>
              </div>`;
    })}
          </div>
        </details>
        <details class="setting-help">
          <summary>How do artwork and fallback work?</summary>
          <p>
            Kaleidescape covers use edition artwork already cached from your
            system. TMDB covers download on the next metadata refresh when
            Library's Cover artwork sync is enabled. Landscape images currently
            come from TMDB. Disabled providers make no requests; their existing
            cache can still be used.
          </p>
        </details>
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Refresh & editing behavior</h3>
            <p>
              Manage provider traffic and how per-movie metadata edits are
              saved.
            </p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        ${this.toggle("metadata_auto_save", "Auto-save metadata manager changes", "Save per-movie source and field choices as they change. This does not auto-save this Settings page.")}
        <div class="setting-field spaced">
          ${P("metadata_requests_per_second", "Shared request limit", "The combined request rate for enabled metadata providers, from 0.1 to 10 requests per second. A lower value slows refreshes and reduces provider traffic; it is not a separate allowance for each provider.")}<span
            class="field-input"
            ><input
              name="metadata_requests_per_second"
              id="metadata_requests_per_second"
              aria-describedby="metadata_requests_per_second-hint"
              type="number"
              min="0.1"
              max="10"
              step="any"
              required
              .value=${String(this.draft.metadata_requests_per_second ?? 2)}
              ?disabled=${this.disabled}
              @input=${(e) => this.change("metadata_requests_per_second", e.target.value)}
            /><span class="unit">req/sec</span></span
          >
        </div>
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Run a metadata refresh</h3>
            <p>Uses the saved Library and provider settings.</p>
          </div>
          <span class="scope-tag">Runs when requested</span>
        </div>
        ${this.actionsDisabled ? a`<p class="settings-note">Save or cancel your configuration changes before starting a refresh.</p>` : this.scope.library_enabled ? l : a`<p class="settings-note">Enable and save Library sync before refreshing metadata.</p>`}
        <div class="actions">
          <button
            type="button"
            ?disabled=${this.disabled || this.actionsDisabled || !this.scope.library_enabled || this.loading || this.status?.running}
            @click=${() => this.refresh(!0)}
          >
            Refresh metadata</button
          ><button
            type="button"
            ?disabled=${this.loading}
            @click=${() => this.refresh()}
          >
            Check metadata status
          </button>
        </div>
        ${this.status ? a`<p role="status">${this.status.running ? "Syncing" : "Idle"} · ${this.status.processed} of ${k(this.status.total, "movie")} · ${k(this.status.updated, "provider update")} · ${k(this.status.skipped, "skipped attempt")}${this.status.error ? ` · ${this.status.error}` : ""}</p>` : l}
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        <details class="setting-help">
          <summary>When is metadata refreshed?</summary>
          <p>
            Library scans do not start external metadata refreshes. Request a
            refresh here, use the Home Assistant button, or configure a
            recurring schedule under Automations. Ambiguous matches are skipped;
            provider errors stop the pass without automatic HTTP retries.
          </p>
        </details>
        <details class="setting-help">
          <summary>Metadata credits</summary>
          ${ws()}
          <p>
            Kaleidescape Store metadata and Rotten Tomatoes scores remain
            attributed to their source. TMDB votes are a separate audience
            rating.
          </p>
        </details>
      </div>
    </section>` : l;
  }
};
dt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  draft: { attribute: !1 },
  disabled: { type: Boolean },
  actionsDisabled: { type: Boolean },
  credentialConfigured: { type: Boolean }
}, dt.styles = [E, qi];
let oi = dt;
customElements.get("kaleidescape-enrichment-settings") || customElements.define("kaleidescape-enrichment-settings", oi);
const sr = {
  invalid_calendar_full_sync: "Use an age window of 1–12 whole months.",
  calendar_dedicated_required: "Acknowledge that Full Sync uses a separate calendar and deletes unmatched events.",
  calendar_full_sync_unsupported: "Full Sync requires a calendar with event creation and deletion support.",
  invalid_calendar: "Choose an existing calendar that supports creating events.",
  invalid_calendar_template: "Use only the listed brace fields, without attributes or format specifiers.",
  invalid_display_options: "Choose a valid default landing page.",
  missing_entities: "Select all three source entities to enable tracking.",
  invalid_entities: "Choose existing media_player and sensor entity IDs.",
  duplicate_entities: "Choose different sensors for play status and media location.",
  invalid_rules: "Check the runtime, completion, and partial-resume values.",
  invalid_metadata_options: "Use a valid provider credential and a request rate from 0.1 to 10 per second.",
  invalid_control_options: "Use a private LAN control hostname/IP and a valid player serial number.",
  invalid_library_host: "Enter a hostname or private LAN HTTP(S) origin without a path, credentials, or query.",
  invalid_library_options: "Choose a purchase window of 0–520 weeks and an artwork cache limit of 32–4096 MiB."
}, ct = class ct extends x {
  constructor() {
    super(), this.tab = "general", this.search = "", this.automationBusy = !1, this.personalReady = !1, this.personalError = "", this.generation = 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.hiddenCollections = [], this.sharedReady = !1, this.sharedError = "", this.customCollection = "", this.loading = !1, this.saving = !1, this.uncertain = !1, this.dashboardBusy = !1, this.error = "", this.bound = "", Ce(this, () => this.loading || this.saving || this.uncertain || this.personalPreferences?.unsettled ? !1 : (this.personalPreferences?.dispose(), this.personalPreferences = void 0, this.personalReady = !1, this.tab === "general" && this.selectTab("general"), !0));
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${!!this.scope?.permissions.edit}`;
    t === this.bound && this.client === this.boundClient || (this.cancelFlow(), this.bound = t, this.boundClient = this.client, this.boundScope = this.scope, this.flow = void 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.customCollection = "", this.uncertain = this.saving = !1, this.client && this.scope?.permissions.edit && this.start());
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
    this.search = "", this.personalPreferences?.dispose(), this.personalPreferences = void 0, this.personalReady = !1, this.personalError = "", this.sharedPreferences?.dispose(), this.sharedPreferences = void 0, this.hiddenCollections = [], this.sharedReady = !1, this.sharedError = "", this.generation++, this.flow?.flow_id && this.boundClient && this.boundScope && this.boundClient.settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id }).catch(() => {
    });
  }
  fail(e) {
    this.error = y(e), g(e) === "unauthorized" && (this.personalPreferences?.dispose(), this.personalPreferences = void 0, this.personalReady = !1, this.sharedPreferences?.dispose(), this.sharedPreferences = void 0, this.sharedReady = !1, this.hiddenCollections = [], this.flow = void 0, this.draft = {}, this.initial = {}, this.dispatchEvent(
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
          Ka.has(o.name) ? !!o.default : String(o.default ?? "")
        ])
      ), this.initial = { ...this.draft }, this.sharedPreferences = new O(
        e,
        t,
        !0,
        (o) => {
          i === this.generation && (o && g(o) === "unauthorized" ? this.fail(o) : (this.sharedError = o ? y(o) : "", this.requestUpdate()));
        }
      );
      const r = await this.sharedPreferences.load();
      if (i !== this.generation) return;
      if (this.hiddenCollections = [...r.hidden_collections], this.sharedReady = !0, t.library_enabled) {
        const o = await e.libraryInfo(t);
        i === this.generation && (this.collectionChoices = o.collection_names ?? []);
      }
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.loading = !1, this.tab === "general" && this.selectTab("general"), this.requestUpdate());
    }
  }
  confirmNavigation() {
    const e = this.renderRoot.querySelector(
      "kaleidescape-calendar-export"
    ), t = this.renderRoot.querySelector(
      "kaleidescape-test-dashboard"
    ), i = this.renderRoot.querySelector(
      "kaleidescape-metadata-repair"
    );
    return this.saving || this.automationBusy || t && !t.confirmNavigation() || e && !e.confirmNavigation() || i && !i.confirmNavigation() ? !1 : this.uncertain ? window.confirm(
      "The settings save may already have committed. Leave this view and inspect saved values before making another change?"
    ) : !ns(this.draft, this.initial).length || window.confirm("Discard your unsaved settings changes?");
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("settings-busy", {
        detail: this.saving || this.dashboardBusy || this.automationBusy,
        bubbles: !0,
        composed: !0
      })
    );
  }
  reload() {
    this.confirmNavigation() && (this.cancelFlow(), this.flow = void 0, this.draft = this.initial = {}, this.uncertain = !1, this.start());
  }
  async save(e) {
    if (e.preventDefault(), !this.client || !this.scope || !this.flow?.flow_id || this.saving || this.uncertain || this.dashboardBusy || this.automationBusy || !this.dirtyKeys.length)
      return;
    const t = this.generation;
    if (!await this.validateForm(e.target) || this.saving || t !== this.generation || !this.scope?.permissions.edit)
      return;
    this.saving = !0, this.busy(), this.error = "", this.requestUpdate();
    const i = { ...this.draft };
    for (const { key: s, type: r } of Pe)
      r === "number" ? i[s] = Number(i[s]) : i[s] || delete i[s];
    for (const { key: s, type: r } of Ue)
      r === "number" && (i[s] = Number(i[s]));
    i.library_host = String(i.library_host ?? ""), i.metadata_requests_per_second !== void 0 && (i.metadata_requests_per_second = Number(
      i.metadata_requests_per_second
    )), i.calendar_full_sync_months !== void 0 && (i.calendar_full_sync_months = Number(i.calendar_full_sync_months)), i.calendar_entity || delete i.calendar_entity;
    try {
      const s = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data: i
      });
      if (t !== this.generation) return;
      if (this.flow = s, s.type === "create_entry")
        this.initial = { ...this.draft }, this.saving = !1, this.busy(), this.dispatchEvent(
          new CustomEvent("settings-saved", { bubbles: !0, composed: !0 })
        );
      else if (s.type === "form") {
        const r = Object.values(s.errors ?? {})[0] ?? "", o = r.includes("calendar") ? "calendar" : r.includes("metadata") ? "metadata" : r.includes("library") ? "library" : r.includes("control") ? "playback" : r.includes("display") ? "general" : [
          "missing_entities",
          "invalid_entities",
          "duplicate_entities",
          "invalid_rules"
        ].includes(r) ? "journal" : void 0;
        o && this.selectTab(o), this.error = Object.values(s.errors ?? {}).map(
          (d) => sr[d] ?? "Check the settings and try again."
        ).join(" ");
      } else
        this.error = "The settings flow ended. Reload settings to continue.";
    } catch (s) {
      t === this.generation && (this.fail(s), this.uncertain = ![
        "unauthorized",
        "invalid_request",
        "conflict"
      ].includes(g(s)));
    } finally {
      t === this.generation && (this.saving = !1, this.busy(), this.requestUpdate());
    }
  }
  async selectTab(e) {
    if (!G.some(([i]) => i === e) || (this.tab = e, this.requestUpdate(), e !== "general" || this.personalPreferences || !this.client || !this.scope))
      return;
    const t = this.generation;
    this.personalPreferences = new O(
      this.client,
      this.scope,
      !1,
      (i) => {
        t === this.generation && (i && g(i) === "unauthorized" ? this.fail(i) : (this.personalError = i ? y(i) : "", this.requestUpdate()));
      },
      "search"
    );
    try {
      if (await this.personalPreferences.load(), t !== this.generation) return;
      this.personalReady = !0;
    } catch (i) {
      if (t !== this.generation) return;
      this.personalError = y(i), this.personalPreferences?.dispose(), this.personalPreferences = void 0, g(i) === "unauthorized" && this.fail(i);
    }
    this.requestUpdate();
  }
  tabKey(e, t) {
    const i = G.map(([o]) => o), s = i.indexOf(t), r = e.key === "ArrowRight" || e.key === "ArrowDown" ? i[(s + 1) % i.length] : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i[(s + i.length - 1) % i.length] : e.key === "Home" ? i[0] : e.key === "End" ? i.at(-1) : void 0;
    r && (e.preventDefault(), this.selectTab(r), this.renderRoot.querySelector(`#settings-tab-${r}`)?.focus());
  }
  submitForm() {
    this.renderRoot.querySelector("#companion-settings-form")?.requestSubmit();
  }
  async validateForm(e) {
    const t = e.querySelector(
      "kaleidescape-enrichment-settings"
    )?.shadowRoot, i = [
      ...t?.querySelectorAll(
        "input, select"
      ) ?? [],
      ...e.querySelectorAll("input, select, textarea")
    ].find((o) => o.willValidate && !o.validity.valid);
    this.search = "", this.requestUpdate();
    const r = (i?.getRootNode() === t ? e.querySelector("kaleidescape-enrichment-settings") : i)?.closest("[data-settings-tab]")?.dataset.settingsTab;
    if (r && r !== this.tab && await this.selectTab(r), await this.updateComplete, i) {
      for (let o = i.parentElement; o; o = o.parentElement)
        o instanceof HTMLDetailsElement && (o.open = !0);
      return i.focus(), i.reportValidity(), !1;
    }
    return e.reportValidity();
  }
  get dirtyKeys() {
    return ns(this.draft, this.initial);
  }
  get blocked() {
    return this.saving || this.uncertain;
  }
  change(e, t) {
    this.blocked || (this.draft = { ...this.draft, [e]: t }, this.requestUpdate());
  }
  heading(e, t, i = "Shared · Save settings") {
    return a`<div class="section-heading">
      <div>
        <h3>${e}</h3>
        <p>${t}</p>
      </div>
      <span
        class=${i.includes("immediately") ? "scope-tag immediate" : "scope-tag"}
        >${i}</span
      >
    </div>`;
  }
  toggle(e) {
    const t = Ri.find(([i]) => i === e);
    return a`<div class="switch-row">
      ${P(e, t[1], t[2])}<input
        type="checkbox"
        role="switch"
        name=${e}
        id=${e}
        aria-describedby=${`${e}-hint`}
        .checked=${!!this.draft[e]}
        @change=${(i) => this.change(e, i.target.checked)}
      />
    </div>`;
  }
  field(e, t) {
    const { key: i, label: s, hint: r, type: o, min: d, max: c, unit: h, placeholder: u } = e;
    return a`<div
      class=${o === "text" ? "setting-field full" : "setting-field"}
    >
      ${P(i, s, r)}<span class="field-input"
        ><input
          name=${i}
          id=${i}
          type=${o ?? "text"}
          min=${d ?? l}
          max=${c ?? l}
          step=${o === "number" ? "1" : l}
          maxlength=${o === "text" ? "255" : l}
          placeholder=${u ?? l}
          list=${t ? `${i}-choices` : l}
          aria-describedby=${`${i}-hint`}
          ?required=${o === "number" || !!t && !!this.draft.tracking_enabled}
          .value=${String(this.draft[i] ?? "")}
          @input=${(p) => this.change(i, p.target.value)}
        />
        ${h ? a`<span class="unit">${h}</span>` : l}</span
      >
      ${t ? a`<datalist id=${`${i}-choices`}>${t.map((p) => a`<option value=${p.value}>${p.label}</option>`)}</datalist>` : l}
    </div>`;
  }
  shortcut(e, t) {
    return a`<button
      type="button"
      class="link"
      @click=${() => this.selectTab(e)}
    >
      ${t} →
    </button>`;
  }
  async findSetting(e) {
    this.search = "", await this.selectTab(e.section), await this.updateComplete;
    let t = this.renderRoot.querySelector(
      `[name="${e.key}"]`
    );
    t || (t = this.renderRoot.querySelector("kaleidescape-enrichment-settings")?.shadowRoot?.querySelector(`[name="${e.key}"]`) ?? null), t || (t = this.renderRoot.querySelector(
      `#settings-${e.section} h2`
    ));
    let i = t;
    for (; i; )
      i instanceof HTMLDetailsElement && (i.open = !0), i = i.parentElement;
    t?.focus(), t?.scrollIntoView?.({ block: "nearest" });
  }
  renderGeneral() {
    return a` <div class="settings-card">
        ${this.heading("Start where you want", "Choose the first page for everyone who opens Companion without a page in the URL.")}
        <div class="setting-field">
          ${P("default_landing_page", "Default landing page", "The shared starting page when a link does not specify one. Unavailable or administrator-only pages fall back to an accessible page for each user.")}<select
            name="default_landing_page"
            id="default_landing_page"
            aria-describedby="default_landing_page-hint"
            .value=${String(this.draft.default_landing_page ?? "journal")}
            @change=${(e) => this.change("default_landing_page", e.target.value)}
          >
            ${[
      ["now-playing", "Now Playing"],
      ["library", "Library"],
      ["journal", "Journal"],
      ["database", "Database"],
      ["settings", "Settings"]
    ].map(
      ([e, t]) => a`<option
                  value=${e}
                  ?selected=${e === this.draft.default_landing_page}
                >
                  ${t}
                </option>`
    )}
          </select>
        </div>
      </div>
      <div class="settings-card">
        ${this.heading("Search & display", "Your preferences are separate from the household configuration.", "Your account · saves immediately")}
        <div class="switch-row">
          ${P("personal_fuzzy_search", "Fuzzy search across all views", "Allow close spelling matches when searching. Turn off for case-insensitive partial matching. This preference saves immediately for your account and current screen-size profile.")}<input
            type="checkbox"
            role="switch"
            name="personal_fuzzy_search"
            id="personal_fuzzy_search"
            aria-describedby="personal_fuzzy_search-hint"
            .checked=${this.personalPreferences?.values.fuzzy_search !== !1}
            ?disabled=${!this.personalReady || this.blocked}
            @change=${(e) => {
      this.personalPreferences?.set({
        fuzzy_search: e.target.checked
      }), this.requestUpdate();
    }}
          />
        </div>
        ${this.personalError ? a`<p class="error" role="alert">${this.personalError}<button type="button" @click=${() => this.personalPreferences?.retry()}>Retry personal settings</button></p>` : l}
        <details class="setting-help">
          <summary>Where do I change layouts and badges?</summary>
          <p>
            Open <strong>Options</strong> in Library, Journal or Database for
            view layouts, page sizes, badges and display choices. They save for
            your account and screen-size profile as you browse. Library sort is
            personal; search and filters stay in the current URL.
          </p>
        </details>
      </div>
      <div class="settings-card setup-guide">
        ${this.heading("Set up your household", "Start with the features you need. Each optional feature can be enabled independently.", "Quick guide")}
        <ol>
          <li>
            ${this.shortcut("journal", "Connect Journal sources")}<small
              >Choose the built-in integration's player and sensors.</small
            >
          </li>
          <li>
            ${this.shortcut("library", "Connect your Library")}<small
              >Bring in movies, collections and artwork.</small
            >
          </li>
          <li>
            ${this.shortcut("automations", "Choose optional automations")}<small
              >Schedule syncs or import purchase receipts.</small
            >
          </li>
        </ol>
      </div>`;
  }
  renderJournal() {
    return a`<div class="settings-card">
        ${this.heading("Automatic recording", "Observe one player and keep the Journal up to date.")}${this.toggle("tracking_enabled")}
        <div class="settings-grid spaced">
          ${Pe.filter((e) => e.type === "text").map((e) => this.field(e, this.flow?.entity_choices?.[e.key === "media_player" ? "media_player" : "sensor"] ?? []))}
        </div>
        <details class="setting-help">
          <summary>How do I choose the right entities?</summary>
          <p>
            Select the player and the two sensors exposed by Home Assistant's
            built-in Kaleidescape integration. Play status identifies playback
            and credits; media location distinguishes main content. Use a
            different sensor for each role. Suggestions show currently loaded
            entities; you can also enter an existing registered entity ID
            manually.
          </p>
          <a href="/config/entities">Open Home Assistant entities</a>
        </details>
      </div>
      <div class="settings-card">
        ${this.heading("Viewing rules", "Fine-tune when a movie is recorded, completed or resumed.")}
        <div class="settings-grid">
          ${Pe.filter((e) => e.type === "number").map((e) => this.field(e))}
        </div>
      </div>`;
  }
  renderLibrary() {
    return a`<div class="settings-card">
        ${this.heading("Local Library connection", "Read the movie catalog from your Kaleidescape system.")}${this.toggle("library_enabled")}
        ${this.draft.library_enabled ? a`<div class="settings-grid spaced">
                  ${this.field(Ue[0])}
                </div>
                <p class="settings-note">
                  A scan runs after setup. For recurring scans, configure the
                  Library sync automation after saving.
                </p>
                ${this.shortcut("automations", "Set up a Library schedule")}` : l}
      </div>
      ${this.draft.library_enabled ? a`<div class="settings-card">
                ${this.heading("What to sync", "Choose the information to read from your system.")}${this.toggle("library_sync_collections")}${this.toggle("library_sync_details")}${this.toggle("library_sync_artwork")}
                <details class="setting-help">
                  <summary>What comes from the device?</summary>
                  <p>
                    Collections determine watched and in-progress status. Detail
                    fields depend on available source metadata. “Added on” means
                    first detected by Companion. Internet providers can fill in
                    additional information separately.
                  </p>
                  ${this.shortcut("metadata", "Choose metadata providers")}
                </details>
              </div>
              <div class="settings-card">
                ${this.heading("Artwork & purchase display", "Control local storage and the Recently Added purchase badge.")}
                <div class="settings-grid">
                  ${Ue.slice(1).map((e) => this.field(e))}
                </div>
                ${this.draft.library_sync_artwork ? a`<p class="settings-note">Artwork uses additional disk space: up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. HA backups can include these cached files.</p>` : l}
              </div>
              <div class="settings-card">
                ${this.heading("Collection actions", "Control whether administrators can queue explicit changes on the device.")}${this.toggle("library_allow_collection_add")}
              </div>` : l}
      <div class="settings-card">
        ${this.heading("Collection visibility", "Hide collection names in shared Library labels and filters. Movies and status remain visible.", "Shared · saves immediately")}${this.renderCollections()}
      </div>`;
  }
  renderPlayback() {
    return a`<div class="settings-card">
        ${this.heading("Playback connection", "The control target is separate from the player observed by the Journal.")}${this.toggle("control_enabled")}
        <div class="settings-grid spaced">
          ${this.field({ key: "control_host", label: "Kaleidescape Player Address", type: "text", section: "playback", hint: "Leave blank to use the Kaleidescape Server Address. Use a private LAN hostname or IP address.", placeholder: "Use Kaleidescape Server Address" })}
        </div>
        <details class="setting-help">
          <summary>What happens when controls are enabled?</summary>
          <p>
            Active Home Assistant users can send player commands from Companion.
            Commands run when clicked. Controls use the local device interface
            on TCP port 10000. Discovery reads the configured system without
            waking players.
          </p>
        </details>
      </div>
      <div class="settings-card">
        ${this.heading("Default player", "Save the connection, discover your system, then select a player and save again.")}
        <ol class="setup-steps">
          <li>Enable controls and save the connection.</li>
          <li>Discover devices and choose a movie player below.</li>
          <li>Save your player selection.</li>
        </ol>
        <kaleidescape-device-controls
          mode="settings"
          .settingsDisabled=${this.blocked}
          .client=${this.client}
          .scope=${this.scope}
          .value=${String(this.draft.control_player ?? "")}
          .configured=${!this.blocked && this.draft.control_enabled === this.initial.control_enabled && this.draft.control_host === this.initial.control_host && this.draft.library_host === this.initial.library_host}
          @player-selected=${(e) => this.change("control_player", e.detail)}
        ></kaleidescape-device-controls>
      </div>
      <div class="settings-card">
        ${this.heading("Launch movies from Library", "An additional opt-in for starting a movie from its details.")}${this.toggle("control_allow_launch")}
      </div>`;
  }
  renderMetadata() {
    return a`<kaleidescape-enrichment-settings
      .client=${this.client}
      .scope=${this.scope}
      .draft=${this.draft}
      .disabled=${this.blocked}
      .actionsDisabled=${this.blocked || this.dirtyKeys.length > 0}
      .credentialConfigured=${!!this.flow?.credential_configured}
      @metadata-settings=${(e) => {
      this.draft = { ...this.draft, ...e.detail }, this.requestUpdate();
    }}
    ></kaleidescape-enrichment-settings>`;
  }
  async insertCalendarField(e, t) {
    const i = this.renderRoot.querySelector(`[name="${e}"]`), s = String(this.draft[e] ?? ""), r = i?.selectionStart ?? s.length, o = i?.selectionEnd ?? s.length;
    this.change(e, s.slice(0, r) + `{${t}}` + s.slice(o)), await this.updateComplete, i?.focus(), i?.setSelectionRange(
      r + t.length + 2,
      r + t.length + 2
    );
  }
  templateHelp(e) {
    return a`<details class="setting-help">
      <summary>Insert a movie or viewing field</summary>
      <p>
        Select a field to insert at the cursor. Missing values are blank;
        duration and watched time use minutes. Double braces produce literal
        braces.
      </p>
      <div class="template-tokens">
        ${["title", "year", "collection", "cast", "director", "writer", "studio", "genre", "duration", "rating", "format", "edition", "synopsis", "purchase_date", "added_on", "status", "started_at", "ended_at", "watched"].map((t) => a`<button type="button" aria-label=${`Insert ${t} in ${e === "calendar_title" ? "event title" : "event description"}`} @click=${() => this.insertCalendarField(e, t)}>{${t}}</button>`)}
      </div>
    </details>`;
  }
  renderCalendar() {
    return a`<div class="settings-card">
        ${this.heading("Calendar publishing", "Add completed viewings to a Home Assistant calendar.")}${this.toggle("calendar_enabled")}
        <p class="settings-note">
          Movie information is shared with the calendar provider and anyone who
          can read that calendar.
        </p>
        ${this.draft.calendar_enabled ? a`<div class="setting-field">
                  ${P("calendar_entity", "Calendar destination", "Choose a Home Assistant calendar that supports creating events. Full Sync also requires deletion support and a dedicated calendar. Changing this destination resets the dedicated-calendar acknowledgement.")}<input
                    name="calendar_entity"
                    id="calendar_entity"
                    aria-describedby="calendar_entity-hint"
                    list="calendar-choices"
                    placeholder="calendar.movies"
                    maxlength="255"
                    required
                    .value=${String(this.draft.calendar_entity ?? "")}
                    @input=${(e) => {
      this.draft = {
        ...this.draft,
        calendar_entity: e.target.value,
        calendar_full_sync_dedicated: !1
      }, this.requestUpdate();
    }}
                  />
                </div>
                <datalist id="calendar-choices">
                  ${(this.flow?.calendar_choices ?? []).map((e) => a`<option value=${e.value}>${e.label}</option>`)}
                </datalist>` : l}
      </div>
      ${this.draft.calendar_enabled ? a`<div class="settings-card">
                ${this.heading("Event format", "Use movie and viewing fields to make calendar entries useful.")}
                <div class="setting-field">
                  ${P("calendar_title", "Event title", "Format each calendar event with placeholders such as {title} and {year}. Use the insertion buttons below; unknown values are blank. Changing the title format can cause a later export to create additional events.")}<input
                    name="calendar_title"
                    id="calendar_title"
                    aria-describedby="calendar_title-hint"
                    maxlength="500"
                    required
                    .value=${String(this.draft.calendar_title ?? "Watched: {title}")}
                    @input=${(e) => this.change("calendar_title", e.target.value)}
                  />
                </div>
                ${this.templateHelp("calendar_title")}
                <div class="setting-field spaced">
                  ${P("calendar_description", "Event description", "Use plain text and supported movie/viewing placeholders. Duration and watched time are in minutes; double braces create literal braces. Standard export leaves existing descriptions unchanged; Full Sync can reconcile them.")}<textarea
                    name="calendar_description"
                    id="calendar_description"
                    aria-describedby="calendar_description-hint"
                    rows="6"
                    maxlength="5000"
                    .value=${String(this.draft.calendar_description ?? "")}
                    @input=${(e) => this.change("calendar_description", e.target.value)}
                  ></textarea>
                </div>
                ${this.templateHelp("calendar_description")}
              </div>
              <div class="settings-card">
                ${this.heading("Dedicated calendar maintenance", "Optional Full Sync reconciles a separate calendar against completed Journal entries.")}${Ga(
      this.draft,
      (e) => {
        this.draft = { ...this.draft, ...e }, this.requestUpdate();
      }
    )}${this.shortcut("automations", "Configure the Full Sync schedule")}
              </div>` : l}
      <div class="settings-card">
        ${this.heading("Existing viewing history", "Export previous completions or inspect calendar jobs using saved settings.", "Runs when requested")}<kaleidescape-calendar-export
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.dirtyKeys.length > 0}
        ></kaleidescape-calendar-export>
      </div>`;
  }
  renderMaintenance() {
    return a`<div class="settings-card">
        ${this.heading("Settings transfer", "Export selected categories or review a settings file before importing it.", "Review before applying")}
        <p class="muted">
          Credentials are excluded. Imported integration settings are staged for
          Save settings; personal and shared display preferences apply when you
          confirm the import.
        </p>
        <kaleidescape-settings-transfer
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.loading}
          @settings-imported=${(e) => {
      this.draft = { ...this.draft, ...e.detail }, this.requestUpdate();
    }}
        ></kaleidescape-settings-transfer>
      </div>
      <div class="settings-card">
        ${this.heading("Metadata repair", "Review local cached metadata before applying a repair.", "Runs when requested")}
        ${this.initial.library_enabled ? a`<kaleidescape-metadata-repair
                .client=${this.client}
                .scope=${this.scope}
                .disabled=${this.blocked || this.dirtyKeys.length > 0}
              ></kaleidescape-metadata-repair>` : a`<p>Enable and save Library sync to use metadata repair.</p>
                ${this.shortcut("library", "Open Library settings")}`}
      </div>
      <div class="settings-card">
        ${this.heading("Test dashboard", "Create a Home Assistant dashboard to try Companion's cards.", "Runs when requested")}
        <kaleidescape-test-dashboard
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.dirtyKeys.length > 0}
          @dashboard-busy=${(e) => {
      this.dashboardBusy !== e.detail && (this.dashboardBusy = e.detail, this.busy(), this.requestUpdate());
    }}
          @access-denied=${() => this.fail(new v("unauthorized"))}
        ></kaleidescape-test-dashboard>
      </div>
      <div class="settings-card">
        ${this.heading("Reload saved settings", "Discard the current configuration draft and fetch the saved values.", "Keeps saved preferences")}<button
          type="button"
          ?disabled=${this.saving || this.loading || this.dashboardBusy}
          @click=${this.reload}
        >
          Reload settings
        </button>
      </div>`;
  }
  renderAbout() {
    return a`<div class="settings-card">
        ${this.heading("Installed versions", "Version information for troubleshooting this installation.", "Read only")}
        <dl class="version-grid">
          ${[
      ["Companion version", this.scope?.integration_version],
      ["pykaleidescape version", this.scope?.pyk_version],
      ["Companion API version", this.scope?.api_version],
      ["Database schema version", this.scope?.schema_version]
    ].map(
      ([e, t]) => a`<div>
                <dt>${e}</dt>
                <dd>${t ?? "Unknown"}</dd>
              </div>`
    )}
        </dl>
      </div>
      <div class="settings-card">
        ${this.heading("Documentation & updates", "Find current guidance and the history of changes.", "Reference")}
        <div class="reference-links">
          <a
            href="https://github.com/raven42/ha-kaleidescape-companion/blob/main/docs/README.md"
            target="_blank"
            rel="noopener noreferrer"
            >Documentation ↗</a
          ><a
            href="https://github.com/raven42/ha-kaleidescape-companion/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            >Release notes ↗</a
          ><a
            href="https://github.com/raven42/ha-kaleidescape-companion/issues"
            target="_blank"
            rel="noopener noreferrer"
            >Report an issue ↗</a
          >
        </div>
        <p class="muted">
          Blueprint versions, change logs and update actions are together in
          Automations. “Bundled” means included with this Companion
          installation.
        </p>
        ${this.shortcut("automations", "Manage automation blueprints")}
      </div>`;
  }
  sectionContent(e) {
    switch (e) {
      case "general":
        return this.renderGeneral();
      case "journal":
        return this.renderJournal();
      case "library":
        return this.renderLibrary();
      case "playback":
        return this.renderPlayback();
      case "metadata":
        return this.renderMetadata();
      case "calendar":
        return this.renderCalendar();
      case "automations":
        return a`<kaleidescape-automation-blueprints
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked}
          @blueprint-busy=${(t) => {
          this.automationBusy = t.detail, this.busy(), this.requestUpdate();
        }}
        ></kaleidescape-automation-blueprints>`;
      case "maintenance":
        return this.renderMaintenance();
      case "about":
        return this.renderAbout();
    }
  }
  render() {
    const e = this.dirtyKeys, t = this.flow?.type === "form" && !!this.scope?.permissions.edit, i = Ya(this.search);
    return a`<section class="settings-page" aria-labelledby="settings-title">
      <div class="settings-top">
        <div>
          <span class="eyebrow">Your household, your way</span>
          <h2 id="settings-title">Settings</h2>
          <p class="save-status" role="status">
            ${this.loading ? "Loading settings…" : this.saving ? "Saving configuration…" : this.uncertain ? "Save result unconfirmed" : e.length ? `${e.length} unsaved ${e.length === 1 ? "setting" : "settings"} · save to apply` : "No unsaved configuration changes"}
          </p>
        </div>
        <div class="actions">
          <button
            type="button"
            ?disabled=${this.saving || this.loading || this.automationBusy || this.dashboardBusy || !e.length && !this.uncertain}
            @click=${this.reload}
          >
            Cancel changes</button
          ><button
            type="button"
            class="primary"
            @click=${this.submitForm}
            ?disabled=${!t || this.blocked || this.loading || this.dashboardBusy || this.automationBusy || !e.length}
          >
            ${this.saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      ${this.uncertain ? a`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : l}
      ${t ? a`<div class="settings-layout">
              <aside class="settings-sidebar">
                <label class="setting-field settings-search"
                  >Find a setting<input
                    type="search"
                    placeholder="Search settings…"
                    maxlength="120"
                    .value=${this.search}
                    @input=${(s) => {
      this.search = s.target.value, this.requestUpdate();
    }}
                    @keydown=${(s) => {
      s.key === "Escape" && (this.search = "", this.requestUpdate());
    }}
                /></label>
                <nav
                  class="settings-tabs"
                  role="tablist"
                  aria-orientation="vertical"
                  aria-label="Settings categories"
                >
                  ${G.map(
      ([s, r]) => a`<button
                        type="button"
                        role="tab"
                        id=${`settings-tab-${s}`}
                        aria-controls=${`settings-${s}`}
                        aria-selected=${this.tab === s}
                        tabindex=${this.tab === s ? 0 : -1}
                        class=${e.some((o) => js.find((d) => d.key === o)?.section === s) ? "has-changes" : ""}
                        @click=${() => {
        this.search = "", this.selectTab(s);
      }}
                        @keydown=${(o) => this.tabKey(o, s)}
                      >
                        ${r}
                      </button>`
    )}
                </nav>
                <label class="setting-field mobile-category"
                  >Settings category<select
                    .value=${this.tab}
                    @change=${(s) => {
      this.search = "", this.selectTab(
        s.target.value
      );
    }}
                  >
                    ${G.map(([s, r]) => a`<option value=${s} ?selected=${this.tab === s}>${r}</option>`)}
                  </select></label
                >
                <p class="settings-legend">
                  Configuration changes apply together when you save. Sections
                  marked “saves immediately” do not need Save settings.
                </p>
              </aside>
              <div class="settings-content">
                ${this.search.trim() ? a`<section
                        class="settings-card search-results"
                        aria-label="Settings search results"
                      >
                        <h3>Search results</h3>
                        <p role="status">
                          ${i.length}
                          ${i.length === 1 ? "setting" : "settings"} found
                        </p>
                        ${i.length ? a`<ul>
                                ${i.map(
      (s) => a`<li>
                                      <button
                                        type="button"
                                        @click=${() => this.findSetting(s)}
                                      >
                                        <span
                                          ><strong>${s.label}</strong
                                          ><small>${s.hint}</small></span
                                        ><span class="scope-tag"
                                          >${G.find(([r]) => r === s.section)?.[1]}</span
                                        >
                                      </button>
                                    </li>`
    )}
                              </ul>` : a`<p>
                                Try a feature such as recording, artwork,
                                receipts or calendar.
                              </p>`}<button
                          type="button"
                          class="link"
                          @click=${() => {
      this.search = "", this.requestUpdate();
    }}
                        >
                          Clear search
                        </button>
                      </section>` : l}
                <form
                  id="companion-settings-form"
                  novalidate
                  @submit=${this.save}
                  @input=${() => this.requestUpdate()}
                  @change=${() => this.requestUpdate()}
                  ?hidden=${!!this.search.trim()}
                >
                  <fieldset class="settings-fieldset" ?disabled=${this.blocked}>
                    ${G.map(
      ([s, , r, o]) => a`<section
                          role="tabpanel"
                          id=${`settings-${s}`}
                          aria-labelledby=${`settings-tab-${s}`}
                          data-settings-tab=${s}
                          ?hidden=${this.tab !== s}
                        >
                          <div class="category-heading">
                            <h2 tabindex="-1">${r}</h2>
                            <p>${o}</p>
                          </div>
                          ${this.sectionContent(s)}
                        </section>`
    )}
                  </fieldset>
                </form>
              </div>
            </div>` : this.loading ? a`<p class="settings-note" role="status">
                Loading your configuration and preferences…
              </p>` : l}
    </section>`;
  }
  renderCollections() {
    if (!this.sharedReady)
      return a`<p>
        Shared display settings could not be loaded. Reload settings to retry.
      </p>`;
    const e = this.hiddenCollections, t = [.../* @__PURE__ */ new Set([...this.collectionChoices, ...e])].sort(
      (i, s) => i.localeCompare(s)
    );
    return a`<fieldset class="full">
      <legend>
        Hidden collection names
        ${Si("Hidden collection names", "Selected names are hidden from shared Library labels and filters. Movies remain visible and source collections still determine status. Changes save immediately and do not modify device collections.")}
      </legend>
      ${this.sharedError ? a`<p class="error" role="alert">${this.sharedError}<button type="button" @click=${() => this.sharedPreferences?.retry()}>Retry UI settings</button></p>` : l}
      <div class="facet-options">
        ${t.map(
      (i) => a`<label class="check"
              ><input
                name="library_excluded_collections"
                type="checkbox"
                .value=${i}
                .checked=${e.includes(i)}
                ?disabled=${e.length >= 200 && !e.includes(i)}
                @change=${(s) => {
        this.hiddenCollections = s.target.checked ? [...e, i] : e.filter((r) => r !== i), this.sharedPreferences?.set({
          hidden_collections: this.hiddenCollections
        }), this.requestUpdate();
      }}
              />${X(i)}</label
            >`
    )}
      </div>
      <div class="actions field-actions">
        <div class="setting-field">
          ${P("custom_collection", "Custom collection name", "Hide a collection name that is not in the current list, including one you may sync later. Enter the source collection's name and choose Add hidden name. You can hide up to 200 names.")}<input
            name="custom_collection"
            id="custom_collection"
            aria-describedby="custom_collection-hint"
            maxlength="256"
            .value=${this.customCollection}
            @input=${(i) => {
      this.customCollection = i.target.value;
    }}
          />
        </div>
        <button
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
    </fieldset>`;
  }
};
ct.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, ct.styles = [
  E,
  qi,
  C`
      [hidden] {
        display: none !important;
      }
      .settings-page {
        max-width: 1240px;
        padding: 0;
        margin: 22px auto 0;
      }
      .settings-top {
        position: sticky;
        top: var(--companion-sticky-top, 0px);
        z-index: 15;
        background: var(--primary-background-color, #f5f7f6);
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        padding: 16px 0;
        margin-bottom: 26px;
      }
      .settings-top h2 {
        font-size: 30px;
        margin: 4px 0 5px;
        letter-spacing: -0.04em;
      }
      .save-status {
        color: var(--muted);
        font-size: 12px;
        margin: 0;
      }
      .settings-layout {
        display: grid;
        grid-template-columns: 205px minmax(0, 1fr);
        gap: 32px;
        align-items: start;
      }
      .settings-sidebar {
        position: sticky;
        top: calc(var(--companion-sticky-top, 0px) + 132px);
        min-width: 0;
      }
      .settings-search {
        margin-bottom: 20px;
        font-size: 12px;
      }
      .settings-tabs {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .settings-tabs button {
        text-align: left;
        background: transparent;
        border-color: transparent;
        padding: 11px 14px;
        position: relative;
      }
      .settings-tabs button[aria-selected="true"] {
        color: var(--accent);
        background: var(--surface);
        border-color: var(--line);
        font-weight: 700;
        box-shadow: inset 3px 0 var(--accent);
      }
      .settings-tabs button.has-changes::after {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
        position: absolute;
        right: 12px;
        top: 19px;
      }
      .settings-legend {
        font-size: 12px;
        color: var(--muted);
        margin: 22px 10px 0;
      }
      .mobile-category {
        display: none;
      }
      .settings-content {
        min-width: 0;
      }
      .settings-fieldset {
        border: 0;
        padding: 0;
        margin: 0;
        min-width: 0;
      }
      .category-heading {
        margin: 0 0 24px;
      }
      .category-heading h2 {
        font-size: 25px;
        font-weight: 650;
        letter-spacing: -0.03em;
        margin: 0 0 8px;
      }
      .category-heading p {
        color: var(--muted);
        margin: 0;
        font-size: 14px;
      }
      .spaced {
        margin-top: 22px;
      }
      .setup-guide ol,
      .setup-steps {
        padding-left: 22px;
        color: var(--muted);
        line-height: 1.7;
      }
      .setup-guide li {
        padding: 6px 0;
      }
      .setup-guide small {
        display: block;
      }
      .template-tokens {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }
      .template-tokens button {
        padding: 5px 9px;
        font-size: 12px;
        min-height: 36px;
      }
      .version-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
      }
      .version-grid dt {
        color: var(--muted);
        font-size: 12px;
      }
      .version-grid dd {
        margin: 5px 0 0;
        font-size: 18px;
        font-weight: 650;
        overflow-wrap: anywhere;
      }
      .reference-links {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        font-size: 14px;
      }
      .search-results ul {
        list-style: none;
        padding: 0;
      }
      .search-results li + li {
        border-top: 1px solid var(--line);
      }
      .search-results li button {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        text-align: left;
        width: 100%;
        border: 0;
        background: transparent;
        padding: 14px 0;
      }
      .search-results small {
        display: block;
        margin-top: 5px;
      }
      @media (max-width: 800px) {
        .settings-layout {
          grid-template-columns: minmax(0, 1fr);
          gap: 22px;
        }
        .settings-sidebar {
          position: static;
        }
        .settings-tabs,
        .settings-legend {
          display: none;
        }
        .mobile-category {
          display: flex;
        }
        .settings-search {
          margin-bottom: 14px;
        }
        .settings-top {
          margin-bottom: 20px;
        }
      }
      @media (max-width: 480px) {
        .settings-top {
          align-items: flex-start;
          flex-direction: column;
          gap: 12px;
        }
        .settings-top .actions {
          width: 100%;
        }
        .settings-top .actions button {
          flex: 1;
          padding-inline: 10px;
        }
        .settings-top h2 {
          font-size: 26px;
        }
        .version-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .search-results li button {
          align-items: flex-start;
          flex-direction: column;
          gap: 8px;
        }
      }
    `
];
let li = ct;
customElements.get("kaleidescape-settings") || customElements.define("kaleidescape-settings", li);
const ar = C`
  .database {
    overflow: visible;
    margin-top: 24px;
  }
  .database .entry-list li {
    height: 64px;
    box-sizing: border-box;
    padding: 8px 12px;
  }
  .database .entry-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .database-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
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
    align-items: center;
    flex-wrap: wrap;
  }
  .database-filters {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    align-items: start;
  }
  .database-edit-field {
    display: grid;
    gap: 8px;
    padding: 8px 4px;
    margin-bottom: 12px;
  }
  .database-edit-field .check {
    margin: 0;
  }
  .database-preview {
    display: block;
    width: 160px;
    height: 240px;
    margin: 16px 0;
  }
  .database-references {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0;
  }
  .database-options-button {
    margin-left: 0;
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
    padding: 2px 12px 0;
  }
  .database-detail .editor {
    padding: 0;
  }
  .database .entry-list li {
    padding: 6px 10px;
  }
  @media (max-width: 900px) {
    .database-toolbar kaleidescape-transfers {
      margin-left: 0;
    }
  }
  @media (max-width: 700px) {
    .database {
      margin-top: 12px;
    }
    .database-toolbar {
      flex-wrap: nowrap;
      padding: 8px 10px;
      overflow-x: auto;
    }
    .database-toolbar > *,
    .database-toolbar .actions {
      flex-shrink: 0;
      flex-wrap: nowrap;
    }
    .database-toolbar button {
      padding-inline: 8px;
      font-size: 12px;
      white-space: nowrap;
    }
    .database-filters {
      padding: 8px 10px;
      gap: 8px;
    }
    .database-filters kaleidescape-database-search {
      flex-basis: 100%;
    }
    .database-filters > label {
      flex: 1;
      min-width: 0;
    }
    .database-filters select {
      width: 100%;
    }
    .table-tabs {
      padding-inline: 8px;
    }
    .database-options-button {
      position: sticky;
      right: 0;
      margin-left: auto;
      background: var(--surface);
      z-index: 1;
      box-shadow: -8px 0 8px var(--surface);
    }
  }
`, ht = class ht extends x {
  constructor() {
    super(...arguments), this.table = "viewings", this.value = "", this.fields = [], this.operators = [], this.disabled = !1, this.open = !1, this.active = 0, this.cursor = 0, this.message = "", this.invalid = !1, this.generation = 0;
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearTimeout(this.timer), this.generation++, this.open = !1;
  }
  willUpdate(e) {
    ["client", "scope", "table"].some((t) => e.has(t)) && (clearTimeout(this.timer), this.generation++, this.message = "", this.invalid = !1, this.open = !1);
  }
  completion() {
    const e = this.value.slice(0, this.cursor);
    if ((e.match(/'/g)?.length ?? 0) % 2)
      return { start: this.cursor, options: [] };
    const t = e.match(/[A-Za-z_0-9.<>!=]*$/)?.[0] ?? "", i = e.slice(0, e.length - t.length).trim(), s = e.match(
      /([A-Za-z_][A-Za-z_0-9.]*)\s+((?:(?:IS(?:\s+NOT)?|NOT)\s+)?[A-Za-z<>!=]*)$/i
    );
    if (s && this.fields.some(
      (o) => o.name.toLowerCase() === s[1].toLowerCase()
    )) {
      const o = s[2].replace(/\s+/g, " ").toLowerCase();
      return {
        start: this.cursor - s[2].length,
        options: this.operators.filter((d) => d.toLowerCase().startsWith(o)).slice(0, 12)
      };
    }
    let r;
    return !i || /(?:\bAND|\bOR|\bNOT|\bWHERE|\()$/i.test(i) ? r = this.fields.map((o) => o.name) : this.fields.some(
      (o) => i.toLowerCase().endsWith(o.name.toLowerCase())
    ) ? r = this.operators : /(?:NULL|'|\d|TRUE|FALSE)$/i.test(i) ? r = ["AND", "OR"] : r = ["''", "0", "TRUE", "FALSE"], {
      start: this.cursor - t.length,
      options: r.filter((o) => o.toLowerCase().startsWith(t.toLowerCase())).slice(0, 12)
    };
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
        this.invalid = !0, this.message = g(t) === "query_syntax" && typeof t.message == "string" ? t.message : y(t), g(t) === "unauthorized" && this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
        );
      } finally {
        e === this.generation && this.requestUpdate();
      }
    }, 250), this.requestUpdate();
  }
  choose(e) {
    const { start: t } = this.completion();
    this.value = this.value.slice(0, t) + e + " " + this.value.slice(this.cursor), this.cursor = t + (e === "''" ? 1 : e.length + 1), this.active = 0, this.changed(), this.updateComplete.then(() => {
      const i = this.renderRoot.querySelector("input");
      i.focus(), i.setSelectionRange(this.cursor, this.cursor);
    });
  }
  render() {
    const { options: e } = this.completion();
    return a`<div class="search">
        <label for="database-query">Search rows / conditions</label>
        <div class="control-row">
          <input
            id="database-query"
            name="database_query"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded=${this.open && !!e.length}
            aria-controls="query-suggestions"
            aria-activedescendant=${this.open && e.length ? `query-option-${this.active}` : l}
            aria-invalid=${this.invalid}
            aria-describedby=${this.message ? "query-result query-help" : "query-help"}
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
    }}
          /><slot name="actions"></slot>
        </div>
        ${this.open && e.length ? a`<div class="suggestions" id="query-suggestions" role="listbox">${e.map((t, i) => a`<button type="button" role="option" id=${`query-option-${i}`} aria-selected=${this.active === i} tabindex="-1" @pointerdown=${(s) => s.preventDefault()} @click=${() => this.choose(t)}>${t}</button>`)}</div>` : l}
      </div>
      ${this.message ? a`<small id="query-result" class=${this.invalid ? "error" : ""} role="status">${this.message}</small>` : l}
      <details class="query-guide">
        <summary>Query help</summary>
        <small id="query-help"
          >Text searches every column. Conditions: purchased_on IS NULL · actors
          CONTAINS 'name' · title LIKE 'Star%'. Double quotes around a plain
          search require whole words. Tab accepts a suggestion; Enter
          searches.</small
        >
      </details>`;
  }
};
ht.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  table: {},
  value: {},
  fields: { attribute: !1 },
  operators: { attribute: !1 },
  disabled: { type: Boolean }
}, ht.styles = C`
    :host {
      display: block;
      min-width: 0;
      flex: 1;
    }
    label {
      display: grid;
      gap: 6px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .control-row {
      display: flex;
      gap: 10px;
      align-items: stretch;
    }
    .control-row input {
      flex: 1;
      min-width: 0;
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
      max-height: min(
        220px,
        calc(var(--companion-viewport-height, 100dvh) * 0.35)
      );
      overflow: auto;
      overscroll-behavior: contain;
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
    .query-guide {
      font-size: 12px;
      color: var(--muted);
      margin-top: 6px;
    }
    .query-guide summary {
      cursor: pointer;
      width: fit-content;
      min-height: 24px;
    }
    .query-guide small {
      display: block;
      line-height: 1.5;
      margin-top: 6px;
    }
    @media (max-width: 600px) {
      input {
        font-size: 16px;
        min-height: 44px;
      }
      .suggestions button {
        min-height: 44px;
        overflow-wrap: anywhere;
      }
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
let di = ht;
customElements.get("kaleidescape-database-search") || customElements.define("kaleidescape-database-search", di);
const pt = class pt extends x {
  constructor() {
    super(...arguments), this.disabled = !1, this.bound = "", this.request = 0, this.query = "", this.items = [], this.active = -1, this.loading = !1, this.more = !1, this.error = "";
  }
  willUpdate() {
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.review?.plan_id}:${this.row?.key}`;
    e === this.bound && this.client === this.boundClient || (this.bound = e, this.boundClient = this.client, this.reset(), this.query = this.row?.title.slice(0, 100) ?? "", this.client && this.scope && this.review && this.row && this.search());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.reset(), this.bound = "", this.boundClient = void 0;
  }
  async focusSearch() {
    await this.updateComplete, this.isConnected && this.renderRoot.querySelector("input")?.focus();
  }
  reset() {
    clearTimeout(this.timer), this.request++, this.query = "", this.items = [], this.active = -1, this.loading = !1, this.more = !1, this.error = "";
  }
  async search() {
    if (!this.client || !this.scope || !this.review || !this.row || this.disabled)
      return;
    const e = ++this.request;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const t = await this.client.searchImportMatches(
        this.scope,
        this.review,
        this.row.key,
        this.query
      );
      if (e !== this.request || !this.isConnected) return;
      this.items = t.items, this.more = t.has_more;
    } catch (t) {
      if (e !== this.request || !this.isConnected) return;
      this.error = y(t), g(t) === "unauthorized" && this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      );
    } finally {
      e === this.request && (this.loading = !1, this.requestUpdate());
    }
  }
  choose(e) {
    this.disabled || this.dispatchEvent(
      new CustomEvent("match-choice", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    );
  }
  cancel() {
    this.disabled || this.dispatchEvent(
      new CustomEvent("match-cancel", { bubbles: !0, composed: !0 })
    );
  }
  key(e) {
    this.disabled || (e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), this.cancel()), ["ArrowDown", "ArrowUp"].includes(e.key) && this.items.length && (e.preventDefault(), this.active = this.active < 0 ? e.key === "ArrowDown" ? 0 : this.items.length - 1 : (this.active + (e.key === "ArrowDown" ? 1 : -1) + this.items.length) % this.items.length, this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#purchase-match-${this.active}`)?.scrollIntoView?.({ block: "nearest" })
    )), e.key === "Enter" && this.active >= 0 && (e.preventDefault(), this.choose(this.items[this.active].id)));
  }
  render() {
    return a`<h3>Match purchase: ${this.row?.title}</h3>
      <label
        >Find a Library movie<input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="purchase-matches"
          aria-expanded=${!!this.items.length}
          aria-activedescendant=${this.active >= 0 ? `purchase-match-${this.active}` : l}
          maxlength="100"
          .value=${this.query}
          ?disabled=${this.disabled}
          @keydown=${this.key}
          @input=${(e) => {
      this.query = e.target.value, clearTimeout(this.timer), this.request++, this.items = [], this.active = -1, this.more = !1, this.error = "", this.timer = setTimeout(() => {
        this.search();
      }, 250), this.requestUpdate();
    }}
      /></label>
      ${this.loading ? a`<p role="status">Searching cached Library…</p>` : l}
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>
              <button ?disabled=${this.disabled} @click=${() => this.search()}>
                Retry search
              </button>` : l}
      <ul
        id="purchase-matches"
        class="suggestions"
        role="listbox"
        aria-label="Matching Library movies"
      >
        ${this.items.map(
      (e, t) => a`<li role="presentation">
              <button
                role="option"
                id=${`purchase-match-${t}`}
                aria-selected=${this.active === t}
                ?disabled=${this.disabled}
                @click=${() => this.choose(e.id)}
              >
                ${e.artwork_key ? a`<kaleidescape-library-cover
                        .client=${this.client}
                        .scope=${this.scope}
                        .queue=${this.queue}
                        .artworkKey=${e.artwork_key}
                        .title=${e.title}
                        aria-hidden="true"
                      ></kaleidescape-library-cover>` : l}
                <span
                  >${e.title} · ${e.year ?? "Year unknown"}<small
                    >${e.directors.join(", ") || "Director unknown"} ·
                    ${k(e.version_count, "version")} · Source
                    ${e.source_hint}</small
                  ></span
                >
              </button>
            </li>`
    )}
      </ul>
      ${!this.loading && !this.error && !this.items.length ? a`<p class="muted">No matching titles. Try part of the Library title.</p>` : l}
      ${this.more ? a`<p class="muted">Showing 20 movies. Refine the search for more specific results.</p>` : l}
      <div class="actions">
        <button ?disabled=${this.disabled} @click=${this.cancel}>
          Cancel match</button
        ><button ?disabled=${this.disabled} @click=${() => this.choose(null)}>
          Clear match
        </button>
      </div>`;
  }
};
pt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  review: { attribute: !1 },
  row: { attribute: !1 },
  queue: { attribute: !1 },
  disabled: { type: Boolean }
}, pt.styles = [
  E,
  C`
      :host {
        display: block;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 16px;
        margin-block: 16px;
      }
      h3 {
        margin-top: 0;
      }
      .suggestions {
        list-style: none;
        padding: 0;
        margin: 8px 0;
        max-height: min(
          240px,
          calc(var(--companion-viewport-height, 100dvh) * 0.35)
        );
        overflow: auto;
        overscroll-behavior: contain;
      }
      .suggestions button {
        width: 100%;
        text-align: left;
        margin-block: 2px;
        overflow-wrap: anywhere;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .suggestions button > span {
        min-width: 0;
      }
      .suggestions kaleidescape-library-cover {
        width: 40px;
        height: 60px;
        flex: 0 0 40px;
        border-radius: 4px;
      }
      .suggestions button[aria-selected="true"] {
        border-color: var(--accent);
      }
      small {
        display: block;
      }
      .actions {
        justify-content: flex-end;
      }
      @media (max-width: 600px) {
        :host {
          padding: 10px;
          margin-block: 10px;
        }
      }
    `
];
let ci = pt;
customElements.get("kaleidescape-import-matcher") || customElements.define(
  "kaleidescape-import-matcher",
  ci
);
const ut = class ut extends x {
  constructor() {
    super(...arguments), this.disabled = !1, this.bound = "", this.generation = 0, this.selected = /* @__PURE__ */ new Set(), this.query = "", this.changesOnly = !1, this.page = 0, this.pageSize = 100, this.working = !1, this.error = "", this.notice = "", this.dialog = null, this.purchaseReview = !1, this.covers = new T();
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.permissions.edit}:${this.scope?.library_enabled}`;
    this.boundClient === this.client && this.bound === t || (this.clear(), this.bound = t, this.boundClient = this.client);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.covers.cache.dispose(), this.covers = new T(), this.controller?.abort(), this.controller = void 0, this.file = void 0, this.review = void 0, this.matching = void 0, this.selected.clear();
    const e = this.renderRoot.querySelector('input[type="file"]');
    e && (e.value = ""), this.pending = void 0, this.working = !1, this.hideDialog(), this.error = this.notice = "", this.busy();
  }
  async openDialog(e, t = !1) {
    if (this.disabled || this.working || this.pending || !this.dispatchEvent(
      new CustomEvent("transfer-open", {
        detail: e,
        bubbles: !0,
        composed: !0,
        cancelable: !0
      })
    ))
      return;
    const i = this.generation;
    if (this.purchaseReview = t, this.dialog = e, this.error = this.notice = "", this.requestUpdate(), await this.updateComplete, !(i !== this.generation || !this.isConnected) && (this.renderRoot.querySelector("dialog")?.showModal(), t && this.client && this.scope)) {
      this.working = !0, this.busy(), this.requestUpdate();
      try {
        const s = await this.client.reconcilePurchases(this.scope);
        if (i !== this.generation) return;
        "empty" in s ? this.notice = "There are no unmatched purchases." : (this.review = s, this.selected.clear(), this.page = 0, this.query = "");
      } catch (s) {
        i === this.generation && this.fail(s);
      } finally {
        i === this.generation && (this.working = !1, this.busy(), this.requestUpdate());
      }
    }
  }
  hideDialog() {
    this.matching = void 0, this.renderRoot.querySelector("dialog")?.close(), this.dialog = null;
  }
  closeDialog(e) {
    e?.preventDefault();
    const t = this.dialog, i = this.purchaseReview ? "purchases" : t;
    this.clear(), this.file = void 0, this.review = void 0, this.matching = void 0, this.selected.clear();
    const s = this.renderRoot.querySelector('input[type="file"]');
    s && (s.value = ""), this.requestUpdate(), this.renderRoot.querySelector(`[data-transfer="${i}"]`)?.focus();
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
    g(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = y(e), this.requestUpdate();
  }
  async exportData(e) {
    if (!this.client || !this.scope || this.working || this.pending || this.disabled)
      return;
    const t = this.generation, i = this.controller = new AbortController(), s = setTimeout(() => i.abort(), 65e3);
    this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const r = await this.client.download(
        this.scope,
        e,
        i.signal
      );
      if (t !== this.generation) return;
      const o = URL.createObjectURL(r), d = document.createElement("a");
      try {
        d.href = o, d.download = `kaleidescape-journal.${e}`, d.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(o), 1e3);
      }
      this.notice = "Export downloaded. Keep this private copy in a protected location.", this.hideDialog();
    } catch (r) {
      t === this.generation && this.fail(r);
    } finally {
      clearTimeout(s), t === this.generation && (this.working = !1, this.controller = void 0, this.busy(), this.requestUpdate());
    }
  }
  async previewData() {
    if (!this.client || !this.scope || !this.file || this.working || this.disabled || this.scope.tracking_enabled && !this.purchaseReview)
      return;
    const e = this.generation, t = this.controller = new AbortController(), i = setTimeout(() => t.abort(), 65e3);
    this.working = !0, this.error = this.notice = "", this.review = void 0, this.matching = void 0, this.selected.clear(), this.busy(), this.requestUpdate();
    try {
      const s = await this.client.previewImport(
        this.scope,
        this.file,
        t.signal,
        this.purchaseReview
      );
      if (e !== this.generation) return;
      this.review = s, this.selected = new Set(
        s.rows.filter(
          (r) => !r.needs_match && ["new", "merge"].includes(r.action) && r.selected_by_default !== !1
        ).map((r) => r.key)
      ), this.page = 0, this.query = "", this.changesOnly = !1;
    } catch (s) {
      e === this.generation && this.fail(s);
    } finally {
      clearTimeout(i), e === this.generation && (this.working = !1, this.controller = void 0, this.busy(), this.requestUpdate());
    }
  }
  async importData() {
    if (!this.client || !this.scope || !this.review || this.matching || this.working || this.disabled || this.scope.tracking_enabled && !this.purchaseReview)
      return;
    this.pending ??= this.client.prepareImport(this.scope, this.review, [
      ...this.selected
    ]);
    const e = this.generation;
    this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const t = await this.client.applyImport(this.pending);
      if (e !== this.generation) return;
      this.pending = void 0, this.review = void 0, this.matching = void 0, this.file = void 0, this.selected.clear(), this.notice = `Imported ${k(t.imported_count, "new entry", "new entries")}; filled missing data in ${t.updated_count}; left ${t.skipped_count} unchanged or unselected.`, this.hideDialog(), this.dispatchEvent(
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
      ].includes(g(t)) && (this.pending = void 0, this.review = void 0, this.matching = void 0, this.selected.clear()), this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.busy(), this.requestUpdate());
    }
  }
  async openMatch(e) {
    this.scope?.tracking_enabled && !this.purchaseReview || (this.matching = e, this.requestUpdate(), await this.updateComplete, this.matching === e && await this.renderRoot.querySelector("kaleidescape-import-matcher")?.focusSearch());
  }
  async chooseMatch(e) {
    if (!this.client || !this.scope || !this.review || !this.matching || this.scope.tracking_enabled && !this.purchaseReview || this.working || this.pending || this.disabled)
      return;
    const t = this.generation, i = this.matching.key;
    this.working = !0, this.error = "", this.busy(), this.requestUpdate();
    try {
      const s = await this.client.matchImportPurchase(
        this.scope,
        this.review,
        i,
        e
      );
      if (t !== this.generation) return;
      const { row: r, ...o } = s;
      this.review = {
        ...this.review,
        ...o,
        rows: this.review.rows.map(
          (d) => d.key === i ? r : d
        )
      }, this.matching = void 0, ["new", "merge"].includes(s.row.action) && !s.row.possible_duplicate ? this.selected.add(i) : this.selected.delete(i), this.page = 0;
    } catch (s) {
      if (t !== this.generation) return;
      this.review = void 0, this.matching = void 0, this.selected.clear(), this.fail(s);
    } finally {
      t === this.generation && (this.working = !1, this.busy(), this.requestUpdate());
    }
  }
  renderReview(e) {
    if (!this.review) return l;
    const t = this.review, i = this.query.trim().toLocaleLowerCase(), s = t.rows.filter(
      (c) => (!this.changesOnly || c.needs_match || !c.needs_match && ["new", "merge"].includes(c.action)) && xs(
        `${c.title} ${c.detail ?? ""} ${c.table} ${Object.keys(c.changes).join(" ")}`,
        i
      )
    ).sort(
      (c, h) => +!!h.needs_match - +!!c.needs_match
    ), r = Math.max(0, Math.ceil(s.length / this.pageSize) - 1), o = Math.min(this.page, r), d = s.slice(
      o * this.pageSize,
      (o + 1) * this.pageSize
    );
    return a`${this.matching ? a`<kaleidescape-import-matcher
              .client=${this.client}
              .scope=${this.scope}
              .review=${t}
              .row=${this.matching}
              .queue=${this.covers}
              .disabled=${e}
              @match-choice=${(c) => this.chooseMatch(c.detail)}
              @match-cancel=${() => {
      this.matching = void 0, this.requestUpdate();
    }}
              @access-denied=${() => this.fail({ code: "unauthorized" })}
            ></kaleidescape-import-matcher>` : l}
      <p role="status">
        ${t.counts.new} new · ${t.counts.merge} mergeable ·
        ${t.counts.unchanged} unchanged · ${t.counts.skip} skipped.
        ${this.selected.size} selected.
        ${t.rows.some((c) => c.needs_match) ? a`${k(t.rows.filter((c) => c.needs_match).length, "purchase requiring review")} shown first.` : l}
      </p>
      ${t.rows.some((c) => c.key.startsWith("purchases:")) ? a`<p class="muted">
              Purchase records can be saved without a Library match and linked
              later. New means a new purchase record, not a new movie. Purchase
              titles preserve the store's wording; Library titles are kept
              unchanged.
            </p>` : l}
      <div class="actions">
        <label
          >Search review<input
            type="search"
            .value=${this.query}
            ?disabled=${e}
            @input=${(c) => {
      this.query = c.target.value, this.page = 0, this.requestUpdate();
    }}
        /></label>
        <label class="check"
          ><input
            type="checkbox"
            .checked=${this.changesOnly}
            ?disabled=${e}
            @change=${(c) => {
      this.changesOnly = c.target.checked, this.page = 0, this.requestUpdate();
    }}
          />Changes only</label
        >
        <button
          ?disabled=${e}
          @click=${() => {
      this.selected = new Set(
        t.rows.filter(
          (c) => !c.needs_match && !c.possible_duplicate && ["new", "merge"].includes(c.action)
        ).map((c) => c.key)
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
            ${d.map((c) => {
      const h = c.key.startsWith("purchases:"), u = h ? c.repair_barrier ? "Blocked by prior repair" : c.possible_duplicate && c.needs_match ? "Review possible duplicate" : c.needs_match ? "Choose Library match" : {
        new: "Add purchase to Library entry",
        merge: "Update purchase record",
        unchanged: "Purchase already imported",
        skip: "Skip purchase"
      }[c.action] : c.action;
      return a`<tr>
                <td>
                  <input
                    type="checkbox"
                    aria-label=${`Import ${c.title}`}
                    .checked=${this.selected.has(c.key)}
                    ?disabled=${e || !!c.needs_match || !["new", "merge"].includes(c.action)}
                    @change=${(p) => {
        p.target.checked ? this.selected.add(c.key) : this.selected.delete(c.key), this.requestUpdate();
      }}
                  />
                </td>
                <td>
                  <div class="review-entry">
                    ${c.artwork_key ? a`<kaleidescape-library-cover
                            .client=${this.client}
                            .scope=${this.scope}
                            .queue=${this.covers}
                            .artworkKey=${c.artwork_key}
                            .title=${c.title}
                            aria-hidden="true"
                            @access-denied=${() => this.fail({ code: "unauthorized" })}
                          ></kaleidescape-library-cover>` : l}
                    <div>
                      ${c.title}<small class="muted" title=${c.key}
                        >${c.detail}</small
                      >
                      <small class="muted"
                        >${h ? "Purchase history on Library entry" : c.table}</small
                      >
                    </div>
                  </div>
                </td>
                <td>${u}</td>
                <td>
                  ${c.reason || Object.keys(c.changes).join(", ") || "No missing data"}
                  ${c.possible_duplicate ? a`<small class="warning">Compare the existing purchases before selecting this as a separate purchase.</small>` : c.needs_match && !c.repair_barrier ? a`<small class="warning">No Library match selected</small>` : l}
                  ${c.duplicate_candidates?.length ? a`<details>
                          <summary>
                            Possible existing purchases
                            (${c.duplicate_candidates.length}${c.duplicate_candidates_more ? "+" : ""})
                          </summary>
                          <p>
                            Similar details are review hints, not proof of a
                            duplicate.
                          </p>
                          ${c.duplicate_candidates.map((p) => a`<pre>${JSON.stringify(p, null, 2)}</pre>`)}
                          ${c.duplicate_candidates_more ? a`<p>More possible matches exist. Inspect Purchases for the full list.</p>` : l}
                        </details>` : l}
                  ${c.can_match ? a`<button
                          ?disabled=${e || !!this.matching || !!this.scope?.tracking_enabled && !this.purchaseReview}
                          @click=${() => this.openMatch(c)}
                        >
                          Match title…
                        </button>` : l}
                  ${c.conflicts.length ? a`<small class="muted">Existing ${h ? "purchase " : ""}values kept: ${c.conflicts.join(", ")}</small>` : l}
                  ${Object.keys(c.changes).length ? a`<details>
                          <summary>
                            ${h ? c.action === "new" ? "Purchase record to add" : "Purchase record changes" : "Changes"}
                          </summary>
                          <pre>${JSON.stringify(c.changes, null, 2)}</pre>
                        </details>` : l}
                </td>
              </tr>`;
    })}
          </tbody>
        </table>
      </div>
      <p class="muted">
        ${d.length === 1 ? "Row" : "Rows"}
        ${s.length ? o * this.pageSize + 1 : 0}–${Math.min((o + 1) * this.pageSize, s.length)}
        of ${s.length}. Selection covers all review pages.
      </p>
      <div class="actions pagination">
        <button
          ?disabled=${e || !o}
          @click=${() => {
      this.page = o - 1, this.requestUpdate();
    }}
        >
          Previous</button
        ><button
          ?disabled=${e || o >= r}
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
            @change=${(c) => {
      this.pageSize = Number(c.target.value), this.page = 0, this.requestUpdate();
    }}
          >
            ${[25, 100, 500].map((c) => a`<option value=${c}>${c}</option>`)}
          </select></label
        >
      </div>`;
  }
  renderImport(e) {
    return this.purchaseReview ? a`
        <p>
          Choose a Library match for each purchase, then apply the selected
          changes.
        </p>
        ${this.notice ? a`<p role="status">${this.notice}</p>` : l}
        ${this.renderReview(e)}
      ` : a`<p>
        Add new IDs and fill missing data in existing viewings and Library
        versions. Populated values, manual corrections and deletion status are
        kept. Only known Library sources match. Newly imported versions stay
        inactive until a server sync verifies them. Session evidence, collection
        membership, artwork files, audit, retry state, purchase repair history
        and replay barriers are not restored. Maximum 32 MiB / 10,000 records.
        Review expires after 10 minutes or any database change. Purchase JSON
        keeps separate orders and proposes exact-name Library group links for
        review. Ambiguous names stay unlinked. Purchase rows start unchecked;
        select the purchases and links you approve.
      </p>
      ${this.scope?.tracking_enabled && !this.purchaseReview ? a`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : l}
      <label
        >JSON or SQLite file<input
          type="file"
          accept=".json,.sqlite,.sqlite3,.db"
          ?disabled=${e || !!this.scope?.tracking_enabled && !this.purchaseReview}
          @change=${(t) => {
      this.file = t.target.files?.[0], this.review = void 0, this.matching = void 0, this.selected.clear(), this.error = this.notice = "", this.requestUpdate();
    }}
      /></label>
      ${this.file ? a`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : l}
      <div class="actions">
        <button
          ?disabled=${e || !this.file || !!this.scope?.tracking_enabled && !this.purchaseReview}
          @click=${this.previewData}
        >
          Review import
        </button>
      </div>
      ${this.renderReview(e)}
      ${this.pending ? a`<div class="warning">
              ${this.working ? "Importing…" : "The import result is unconfirmed. Retry the same selection and request to confirm it."}
              <div class="actions">
                <button ?disabled=${this.working} @click=${this.importData}>
                  Retry same import</button
                ><button
                  ?disabled=${this.working}
                  @click=${() => {
      window.confirm(
        "The import may already have committed. Discard its retry and inspect the database before importing again?"
      ) && (this.pending = void 0, this.review = void 0, this.matching = void 0, this.file = void 0, this.selected.clear(), this.hideDialog(), this.busy(), this.dispatchEvent(
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
            </div>` : l}`;
  }
  render() {
    const e = this.disabled || this.working || !!this.pending;
    return a`<div class="actions" aria-label="Import and export">
        <button
          data-transfer="import"
          ?disabled=${e}
          @click=${() => this.openDialog("import")}
        >
          Merge Import
        </button>
        <button
          data-transfer="purchases"
          ?disabled=${e}
          @click=${() => this.openDialog("import", !0)}
        >
          Reconcile purchases
        </button>
        <button
          data-transfer="export"
          ?disabled=${e}
          @click=${() => this.openDialog("export")}
        >
          Export
        </button>
      </div>
      ${!this.dialog && this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      ${!this.dialog && this.notice ? a`<p class="notice" role="status">${this.notice}</p>` : l}
      <dialog
        class="database-dialog"
        @click=${q}
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : this.purchaseReview ? "Reconcile purchases" : "Merge Import"}
          </h2>
          ${S((t) => this.closeDialog(t))}
        </div>
        ${this.error && this.dialog ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.dialog === "export" ? a`<p>
                Exports include private history and deleted records. SQLite also
                includes catalog, source metadata, purchase repair history and
                replay barriers. JSON does not preserve repair history or replay
                barriers. Use a SQLite backup for a full restore. Store
                downloads securely.
              </p> ` : this.dialog === "import" ? this.renderImport(e) : l}
        ${this.dialog === "export" || this.dialog === "import" && this.review ? a`<div class="actions dialog-footer">
                ${this.dialog === "export" ? a`<button ?disabled=${e} @click=${() => this.exportData("json")}>Export JSON</button><button class="primary" ?disabled=${e} @click=${() => this.exportData("sqlite")}>Export SQLite</button>` : a`<button class="primary" ?disabled=${e || !!this.matching || !this.selected.size} @click=${this.importData}>Apply ${k(this.selected.size, "selected change")}</button>`}
              </div>` : l}
      </dialog>`;
  }
};
ut.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, ut.styles = [
  E,
  C`
      .database-dialog {
        width: min(1100px, calc(100% - 32px));
      }
      table {
        table-layout: fixed;
        min-width: 620px;
      }
      th:first-child {
        width: 56px;
      }
      th:nth-child(2) {
        width: 30%;
      }
      th:nth-child(3) {
        width: 160px;
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
        max-height: min(
          55dvh,
          max(120px, calc(var(--companion-viewport-height, 100dvh) - 260px))
        );
        overflow: auto;
        overscroll-behavior: contain;
      }
      th {
        position: sticky;
        top: 0;
      }
      .review-entry {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .review-entry > div {
        min-width: 0;
      }
      .review-entry kaleidescape-library-cover {
        width: 42px;
        height: 63px;
        flex: 0 0 42px;
        border-radius: 4px;
      }
      .pagination {
        align-items: flex-end;
      }
      .pagination label {
        margin: 0;
      }
      .pagination select {
        width: auto;
        min-width: 86px;
      }
      @media (max-width: 600px) {
        .database-dialog {
          width: calc(100% - 16px);
        }
        .actions {
          gap: 6px;
        }
      }
    `
];
let hi = ut;
customElements.get("kaleidescape-transfers") || customElements.define("kaleidescape-transfers", hi);
const Te = [
  ["title", "Receipt title"],
  ["purchased_on", "Purchase date"],
  ["purchase_price", "Purchase price"],
  ["retail_price", "Retail price"],
  ["order_id", "Transaction ID"],
  ["href", "Store link"]
];
function pi(n, e = "") {
  return n !== null && typeof n == "object" ? Object.fromEntries(
    Object.entries(n).flatMap(
      ([t, i]) => Object.entries(pi(i, e ? `${e}.${t}` : t))
    )
  ) : e ? { [e]: n } : {};
}
function ls(n) {
  return n === void 0 ? "—" : n === null ? "null" : typeof n == "string" ? n : JSON.stringify(n);
}
function At(n, e, t) {
  const i = pi(e), s = pi(t), r = [.../* @__PURE__ */ new Set([...Object.keys(i), ...Object.keys(s)])];
  return a`<h4>${n}</h4>
    <div class="diff" role="table" aria-label=${n}>
      <div class="diff-row" role="row">
        <strong role="columnheader">Field</strong>
        <strong role="columnheader">Before</strong>
        <strong role="columnheader">After</strong>
      </div>
      ${r.length ? r.map((o) => {
    const d = JSON.stringify(i[o]) !== JSON.stringify(s[o]), c = Te.find(([h]) => h === o)?.[1] ?? o;
    return a`<div
                class=${d ? "diff-row changed" : "diff-row"}
                role="row"
              >
                <span role="rowheader"
                  >${c}${d ? " (changed)" : ""}</span
                >
                <span class="before" role="cell"
                  >${ls(i[o])}</span
                >
                <span class="after" role="cell"
                  >${ls(s[o])}</span
                >
              </div>`;
  }) : a`<p>No values to compare.</p>`}
    </div>`;
}
const gt = class gt extends x {
  constructor() {
    super(...arguments), this.row = {}, this.token = "", this.reverse = !1, this.action = "correct", this.draft = {}, this.query = "", this.results = [], this.owner = null, this.ownerLabel = "", this.confirmed = !1, this.busy = !1, this.error = "", this.fieldErrors = {}, this.generation = 0;
  }
  connectedCallback() {
    super.connectedCallback(), this.draft = Object.fromEntries(
      Te.map(([e]) => [e, String(this.row[e] ?? "")])
    ), this.owner = typeof this.row.library_id == "string" ? this.row.library_id : null, this.ownerLabel = this.owner ? "Current Library entry" : "Unlinked";
  }
  firstUpdated() {
    this.renderRoot.querySelector("dialog")?.showModal();
  }
  disconnectedCallback() {
    this.generation++, super.disconnectedCallback();
  }
  confirmNavigation() {
    return this.busy || this.pending ? !1 : !this.review && (this.reverse || !Object.keys(this.changes()).length) || window.confirm("Discard this purchase repair review?");
  }
  close(e) {
    e?.preventDefault(), this.confirmNavigation() && this.dispatchEvent(
      new CustomEvent("repair-cancel", { bubbles: !0, composed: !0 })
    );
  }
  notifyBusy() {
    this.dispatchEvent(
      new CustomEvent("repair-busy", {
        detail: this.busy || !!this.pending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  report(e) {
    this.error = y(e), g(e) === "unauthorized" && (this.pending = void 0, this.review = void 0, this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async search() {
    if (!this.client || !this.scope || this.busy) return;
    const e = ++this.generation;
    this.busy = !0, this.notifyBusy(), this.error = "", this.requestUpdate();
    try {
      const t = await this.client.librarySearch(
        this.scope,
        this.query,
        !1
      );
      e === this.generation && (this.results = t.items);
    } catch (t) {
      e === this.generation && this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.notifyBusy(), this.requestUpdate());
    }
  }
  changes() {
    const e = {};
    for (const [t] of Te) {
      const i = this.draft[t] || null;
      i !== (this.row[t] ?? null) && (e[t] = i);
    }
    return this.owner !== (this.row.library_id ?? null) && (e.library_id = this.owner), e;
  }
  validate() {
    const e = {}, t = this.draft.title ?? "";
    t.trim() ? [...t].length > 500 && (e.title = "The receipt title must be at most 500 characters.") : e.title = "Enter a receipt title.";
    const i = this.draft.purchased_on ?? "";
    (this.renderRoot.querySelector(
      '[name="purchased_on"]'
    )?.validity.badInput || i && (i < "1990-01-01" || i > (/* @__PURE__ */ new Date()).toISOString().slice(0, 10))) && (e.purchased_on = "Enter a valid date between January 1, 1990 and today (UTC).");
    for (const d of ["purchase_price", "retail_price"]) {
      const c = this.draft[d] ?? "";
      c && (c.length > 64 || !/^[^\d\s.,+-]{1,8}\s*(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\.[0-9]{2}$/u.test(
        c
      )) && (e[d] = "Enter a nonnegative price with a currency symbol and two decimal places, such as $19.99.");
    }
    const r = this.draft.order_id ?? "";
    r && (!r.trim() || [...r].length > 256) && (e.order_id = "Enter a transaction ID of up to 256 characters, or leave it empty.");
    const o = this.draft.href ?? "";
    if (o) {
      let d = o.startsWith("/movie-store/") || o.startsWith("movie-store/");
      try {
        const c = new URL(o);
        d = ["http:", "https:"].includes(c.protocol) && !!c.hostname && !c.username && !c.password;
      } catch {
      }
      (!d || [...o].length > 2048 || [...o].some((c) => c.charCodeAt(0) < 32)) && (e.href = "Enter an HTTP(S) link without credentials or a /movie-store/ path, or leave it empty.");
    }
    return this.fieldErrors = e, Object.keys(e).length ? (this.error = "Correct the highlighted fields before reviewing the change.", !1) : Object.keys(this.changes()).length ? !0 : (this.error = "Change a purchase field or its Library association before reviewing.", !1);
  }
  async preview() {
    if (!this.client || !this.scope || this.busy) return;
    if (!this.reverse && this.action === "correct" && !this.validate()) {
      this.requestUpdate();
      return;
    }
    const e = ++this.generation;
    this.busy = !0, this.notifyBusy(), this.error = "", this.requestUpdate();
    try {
      const t = this.reverse ? "reverse" : this.action, i = String(this.reverse ? this.row.request_id : this.row.id), s = await this.client.previewPurchaseRepair(
        this.scope,
        t,
        i,
        this.token,
        t === "correct" ? this.changes() : {}
      );
      e === this.generation && (this.review = s, this.confirmed = !1);
    } catch (t) {
      e === this.generation && this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.notifyBusy(), this.requestUpdate());
    }
  }
  async apply() {
    if (!this.client || !this.scope || !this.review || this.busy || !this.confirmed)
      return;
    this.pending ??= this.client.preparePurchaseRepair(this.scope, this.review);
    const e = ++this.generation;
    this.busy = !0, this.notifyBusy(), this.error = "", this.requestUpdate();
    try {
      if (await this.client.applyPurchaseRepair(this.pending), e !== this.generation) return;
      this.pending = void 0, this.dispatchEvent(
        new CustomEvent("repair-complete", { bubbles: !0, composed: !0 })
      );
    } catch (t) {
      if (e !== this.generation) return;
      ["conflict", "invalid_request", "not_found", "unauthorized"].includes(
        g(t)
      ) && (this.pending = void 0, this.review = void 0), this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.notifyBusy(), this.requestUpdate());
    }
  }
  render() {
    return a`
      <dialog
        @click=${q}
        @cancel=${this.close}
        aria-labelledby="repair-heading"
      >
        <div class="card-head">
          <h2 id="repair-heading">
            ${this.reverse ? "Reverse purchase repair" : "Repair purchase"}
          </h2>
          ${S((e) => this.close(e), this.busy || !!this.pending)}
        </div>
        <p>
          Review the invoice, its Library association and totals before applying
          a change. Similar purchases may be legitimate separate transactions.
        </p>
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.review ? a`
                ${At("Purchase", this.review.before, this.review.after)}
                ${At("Library association", this.review.before_library, this.review.after_library)}
                ${At(
      "Library totals",
      this.review.totals_change.map((e) => ({
        source_id: e.source_id,
        totals: e.before
      })),
      this.review.totals_change.map((e) => ({
        source_id: e.source_id,
        totals: e.after
      }))
    )}
                <label class="check"
                  ><input
                    type="checkbox"
                    .checked=${this.confirmed}
                    ?disabled=${this.busy || !!this.pending}
                    @change=${(e) => {
      this.confirmed = e.target.checked, this.requestUpdate();
    }}
                  />I reviewed this change and its totals.</label
                >
                <div class="actions">
                  <button
                    ?disabled=${this.busy || !!this.pending}
                    @click=${() => {
      this.review = void 0, this.requestUpdate();
    }}
                  >
                    Back
                  </button>
                  <button
                    ?disabled=${this.busy || !this.confirmed}
                    @click=${this.apply}
                  >
                    ${this.pending ? "Retry change" : "Apply reviewed change"}
                  </button>
                </div>
              ` : a`
                ${this.reverse ? l : a`
                        <label
                          >Action<select
                            .value=${this.action}
                            ?disabled=${this.busy}
                            @change=${(e) => {
      this.action = e.target.value, this.requestUpdate();
    }}
                          >
                            <option value="correct">Correct purchase</option>
                            <option value="void">Void purchase</option>
                          </select></label
                        >
                        ${this.action === "correct" ? a`
                                <div class="fields">
                                  ${Te.map(
      ([e, t]) => a`
                                      <label
                                        >${t}<input
                                          name=${e}
                                          type=${e === "purchased_on" ? "date" : "text"}
                                          .value=${this.draft[e] ?? ""}
                                          aria-invalid=${this.fieldErrors[e] ? "true" : "false"}
                                          aria-describedby=${this.fieldErrors[e] ? `error-${e}` : l}
                                          ?disabled=${this.busy}
                                          @input=${(i) => {
        this.draft[e] = i.target.value, this.fieldErrors[e] && (delete this.fieldErrors[e], this.requestUpdate());
      }}
                                        />${this.fieldErrors[e] ? a`<span class="error" id=${`error-${e}`}>${this.fieldErrors[e]}</span>` : l}</label
                                      >
                                    `
    )}
                                </div>
                                <p>Library association: ${this.ownerLabel}</p>
                                <label
                                  >Find a Library movie<input
                                    type="search"
                                    .value=${this.query}
                                    ?disabled=${this.busy}
                                    @input=${(e) => {
      this.query = e.target.value;
    }}
                                /></label>
                                <button
                                  type="button"
                                  ?disabled=${this.busy}
                                  @click=${this.search}
                                >
                                  Search Library
                                </button>
                                <button
                                  type="button"
                                  ?disabled=${this.busy}
                                  @click=${() => {
      this.owner = null, this.ownerLabel = "Unlinked", this.requestUpdate();
    }}
                                >
                                  Unlink purchase
                                </button>
                                <div class="search-results">
                                  ${this.results.map(
      (e) => a`
                                      <button
                                        type="button"
                                        ?disabled=${this.busy}
                                        @click=${() => {
        this.owner = e.id, this.ownerLabel = e.title, this.results = [], this.requestUpdate();
      }}
                                      >
                                        ${e.title} ${e.year ?? ""}
                                      </button>
                                    `
    )}
                                </div>
                              ` : a`<p class="warning">
                                Voiding removes this invoice from active totals
                                and prevents its identity from being imported
                                again.
                              </p>`}
                      `}
                <div class="actions">
                  <button ?disabled=${this.busy} @click=${this.close}>
                    Cancel</button
                  ><button ?disabled=${this.busy} @click=${this.preview}>
                    Review change
                  </button>
                </div>
              `}
      </dialog>
    `;
  }
};
gt.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  row: { attribute: !1 },
  token: { type: String },
  reverse: { type: Boolean }
}, gt.styles = [
  E,
  C`
      :host {
        display: block;
      }
      dialog {
        width: min(1000px, calc(100% - 24px));
      }
      .fields {
        display: grid;
        gap: 0.7rem;
      }
      .diff {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 6px;
      }
      .diff-row {
        display: grid;
        grid-template-columns: minmax(9rem, 1fr) minmax(13rem, 2fr) minmax(
            13rem,
            2fr
          );
        min-width: 35rem;
      }
      .diff-row > * {
        padding: 0.5rem;
        border-bottom: 1px solid var(--line);
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .diff-row.changed .before {
        background: rgba(190, 45, 45, 0.2);
        border-left: 3px solid #c64141;
      }
      .diff-row.changed .after {
        background: rgba(36, 145, 76, 0.2);
        border-left: 3px solid #319653;
      }
      .search-results {
        max-height: 16rem;
        overflow: auto;
      }
    `
];
let ui = gt;
customElements.get("kaleidescape-purchase-repair") || customElements.define(
  "kaleidescape-purchase-repair",
  ui
);
const pe = {
  viewings: "Viewings",
  sessions: "Sessions",
  library: "Library",
  library_collections: "Library collections",
  library_sources: "Library sources",
  library_artwork: "Library artwork",
  settings: "UI settings",
  purchase_records: "Purchases",
  purchase_repair_events: "Purchase repair history",
  purchase_identity_barriers: "Purchase replay barriers",
  library_memberships: "Library memberships",
  requests: "Write requests",
  schema_metadata: "Metadata",
  manual_audit: "Manual audit",
  maintenance_audit: "Maintenance audit",
  import_audit: "Import audit",
  database_audit: "Database audit",
  library_collection_intents: "Collection change receipts",
  calendar_publications: "Calendar publications",
  calendar_sync_jobs: "Calendar exports",
  calendar_sync_items: "Calendar export items"
}, ue = ["viewings", "sessions", "library", "purchase_records"], ft = class ft extends x {
  constructor() {
    super(), this.bound = "", this.generation = 0, this.mutationEpoch = 0, this.request = 0, this.table = "viewings", this.filters = { limit: 25, query: "", descending: !1 }, this.fitPage = !0, this.showSystem = !1, this.sorts = {}, this.fuzzySearch = !0, this.ready = !1, this.preferenceError = "", this.loading = !1, this.saving = !1, this.transferBusy = !1, this.repairing = !1, this.repairPending = !1, this.error = "", this.notice = "", this.search = "", this.selected = /* @__PURE__ */ new Set(), this.operation = null, this.draft = {}, this.nulls = /* @__PURE__ */ new Set(), this.original = "", this.createDraft = Ie(), this.confirmed = !1, this.deleteWord = "", this.covers = new T(), this.scheduleFit = () => {
      clearTimeout(this.fitTimer), !(!this.fitPage || !this.ready || !this.page || this.blocked || this.operation) && (this.fitTimer = setTimeout(() => this.resizePage(), 120));
    }, Ai(this, () => this.scheduleFit()), Ce(this, () => {
      if (!this.ready || this.preferences?.unsettled || this.blocked || this.operation || this.renderRoot.querySelector("dialog[open]"))
        return !1;
      const e = this.detail && this.page ? {
        row: this.detail,
        index: this.page.offset + this.page.items.indexOf(this.detail),
        table: this.table,
        filters: { ...this.filters },
        revision: this.page.revision
      } : void 0;
      return this.clear(), this.initialize(e), !0;
    });
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.permissions.edit}`;
    t === this.bound && this.client === this.boundClient || (this.clear(), this.bound = t, this.boundClient = this.client, this.client && this.scope?.permissions.edit && this.initialize());
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("resize", this.scheduleFit), window.visualViewport?.addEventListener("resize", this.scheduleFit), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener("resize", this.scheduleFit), window.visualViewport?.removeEventListener("resize", this.scheduleFit), this.fitObserver?.disconnect(), this.fitObserver = void 0, this.fitList = void 0, clearTimeout(this.fitTimer), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  clear() {
    this.covers.cache.dispose(), this.covers = new T(), this.generation++, this.request++, this.preferences?.dispose(), this.preferences = void 0, this.fuzzySearch = !0, this.ready = !1, this.page = void 0, this.table = "viewings", this.fitPage = !0, this.filters = { limit: 25, query: "", descending: !1 }, this.showSystem = !1, this.sorts = {}, this.detail = void 0, this.selected.clear(), this.pending = void 0, this.operation = null, this.draft = {}, this.original = "", this.search = "", this.confirmed = !1, this.deleteWord = "", this.loading = this.saving = this.transferBusy = this.repairing = this.repairPending = !1, this.error = this.notice = this.preferenceError = "";
    for (const e of this.renderRoot.querySelectorAll("dialog"))
      e.close();
    this.busy(), this.requestUpdate();
  }
  async initialize(e) {
    const t = ++this.generation;
    this.preferences?.dispose(), this.preferences = new O(
      this.client,
      this.scope,
      !1,
      (i) => {
        t === this.generation && (i && g(i) === "unauthorized" ? this.fail(i) : (this.preferenceError = i ? y(i) : "", this.requestUpdate()));
      },
      "database"
    );
    try {
      const [i, s] = await Promise.all([
        this.preferences.load(),
        this.client.uiPreferences(this.scope, !1, "search")
      ]);
      if (t !== this.generation) return;
      this.fuzzySearch = s.values.fuzzy_search, this.fitPage = i.limit === "fit" || i.limit === void 0, this.filters.limit = this.fitPage ? 25 : i.limit, this.showSystem = i.show_system, this.sorts = i.sorts ?? {}, this.table = String(i.table ?? "viewings"), !this.showSystem && !ue.includes(this.table) && (this.table = "viewings"), this.filters = { ...this.filters, ...this.sorts[this.table] }, e && (this.table = e.table, this.showSystem ||= !ue.includes(this.table), this.filters = { ...e.filters, limit: this.filters.limit }, this.search = this.filters.query), this.ready = !0, await this.load(
        e ? Math.floor(e.index / this.filters.limit) * this.filters.limit : 0,
        e?.revision,
        e?.row
      );
    } catch (i) {
      t === this.generation && this.fail(i);
    }
  }
  updated() {
    const e = this.renderRoot.querySelector(".entry-list");
    e !== this.fitList && (this.fitObserver?.disconnect(), this.fitList = e ?? void 0, this.fitObserver ??= new ResizeObserver(this.scheduleFit), e && this.fitObserver.observe(e)), this.scheduleFit();
    for (const [t, i] of [
      ["database_limit", this.fitPage ? "fit" : String(this.filters.limit)],
      ["database_sort", this.filters.sort ?? this.page?.columns[0] ?? ""]
    ]) {
      const s = this.renderRoot.querySelector(
        `[name="${t}"]`
      );
      s && s.value !== i && (s.value = i);
    }
  }
  resizePage() {
    if (!this.fitPage || this.blocked || this.operation || !this.page) return;
    const e = this.renderRoot.querySelector(".entry-list");
    if (!e || e.clientHeight <= 0) return;
    const t = [...e.querySelectorAll("li")].map((d) => d.getBoundingClientRect().height).filter((d) => d > 0);
    if (!t.length) return;
    const i = Math.max(
      1,
      Math.min(500, Math.floor((e.clientHeight - 8) / Math.max(...t)))
    );
    if (i === this.filters.limit) return;
    const s = this.detail ? this.page.items.indexOf(this.detail) : -1, r = this.page.offset + Math.max(0, s), o = this.detail;
    this.filters.limit = i, this.load(
      Math.floor(r / i) * i,
      this.page.revision,
      o
    );
  }
  get blocked() {
    return this.loading || this.saving || !!this.pending || this.transferBusy || this.repairing;
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("maintenance-busy", {
        detail: this.saving || !!this.pending || this.transferBusy || this.repairPending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  fail(e) {
    g(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
    const t = g(e), i = e?.message;
    this.error = ["query_syntax", "conflict", "invalid_request", "busy"].includes(t) && typeof i == "string" && i !== t ? i : y(e), this.requestUpdate();
  }
  async load(e = 0, t, i) {
    if (!this.client || !this.scope || !this.ready || this.pending) return;
    const s = this.generation, r = ++this.request;
    this.loading = !0, this.page?.table !== this.table && (this.page = void 0), this.error = "", i || (this.detail = void 0), this.selected.clear(), this.requestUpdate();
    try {
      const o = await this.client.inspect(
        this.scope,
        this.table,
        e,
        t,
        this.filters
      );
      if (s !== this.generation || r !== this.request) return;
      if (this.page = o, i) {
        const d = o.schema?.filter((c) => c.primary).map((c) => c.name) ?? [];
        this.detail = o.items.find(
          (c) => d.length ? d.every((h) => c[h] === i[h]) : JSON.stringify(c) === JSON.stringify(i)
        );
      }
      this.filters.sort = o.sort;
    } catch (o) {
      s === this.generation && r === this.request && this.fail(o);
    } finally {
      if (s === this.generation && r === this.request && (this.loading = !1, this.requestUpdate(), await this.updateComplete, s === this.generation && r === this.request)) {
        const o = this.renderRoot.querySelector(".entry-list");
        o && (o.scrollTop = 0);
        const d = this.renderRoot.querySelector("li.selected");
        i && d && o && (o.scrollTop = Math.max(
          0,
          d.offsetTop - o.offsetTop + d.offsetHeight - o.clientHeight
        ));
      }
    }
  }
  async follow(e) {
    if (this.blocked || !this.detail || !this.page?.tables || !(e.table in this.page.tables))
      return;
    const t = [];
    for (const [r, o] of Object.entries(e.key)) {
      const d = this.detail[o];
      if (d == null || !/^[a-z_]+$/.test(r) || !["string", "number"].includes(typeof d))
        return;
      t.push(
        `${r} = ${typeof d == "number" ? d : `'${String(d).replaceAll("'", "''")}'`}`
      );
    }
    ue.includes(e.table) || (this.showSystem = !0, this.preferences?.set({ show_system: !0 })), this.table = e.table, this.search = `WHERE ${t.join(" AND ")}`, this.filters = {
      limit: this.filters.limit,
      query: this.search,
      ...this.sorts[this.table]
    }, this.preferences?.set({ table: this.table });
    const i = this.generation, s = this.table;
    await this.load(), !(i !== this.generation || s !== this.table) && (this.page?.items[0] ? this.showDetail(this.page.items[0]) : this.notice = "The referenced entry no longer exists.", this.requestUpdate());
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
    this.detail = e, this.requestUpdate(), this.updateComplete.then(() => {
      if (this.detail !== e) return;
      const t = this.renderRoot.querySelector(".entries-detail");
      t && (t.scrollTop = 0);
    });
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
    this.blocked || this.table !== "viewings" || (this.operation = "new", this.createDraft = Ie(), this.original = JSON.stringify(this.createDraft), this.confirmed = !1, this.open("database-edit"));
  }
  deleteEntries() {
    this.blocked || !this.page?.deletable || !this.selectedRows().length || (this.operation = "delete", this.deleteWord = "", this.open("database-delete"));
  }
  discard() {
    return this.pending || this.saving ? !1 : (this.operation === "edit" ? JSON.stringify([this.draft, [...this.nulls]]) : this.operation === "new" ? JSON.stringify(this.createDraft) : this.original) === this.original || window.confirm("Discard unsaved database changes?");
  }
  confirmNavigation() {
    return !this.transferBusy && !this.saving && !this.pending && this.discard() && (this.renderRoot.querySelector(
      "kaleidescape-purchase-repair"
    )?.confirmNavigation() ?? !0);
  }
  close(e) {
    if (e?.preventDefault(), !(!this.saving && !this.pending && !this.discard())) {
      this.mutationEpoch++, this.pending = void 0, this.saving = !1, this.busy();
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
              data: Ds(this.createDraft)
            });
          else {
            const s = {};
            if (this.operation === "edit") {
              for (const r of this.page.schema ?? []) {
                if (!r.editable) continue;
                let o = this.nulls.has(r.name) ? null : this.draft[r.name];
                if (o !== null && r.type === "number") {
                  if (!String(o).trim()) throw new Error("invalid");
                  if (o = Number(o), !Number.isFinite(o)) throw new Error("invalid");
                }
                o !== null && r.type === "json" && (o = JSON.parse(String(o)), o = JSON.stringify(o)), JSON.stringify(o) !== JSON.stringify(this.detail[r.name]) && (s[r.name] = o);
              }
              if (!Object.keys(s).length) {
                this.close();
                return;
              }
            }
            this.pending = this.client.prepareDatabaseMutation(this.scope, {
              table: this.table,
              operation: this.operation,
              rows: (this.operation === "edit" ? [this.detail] : this.selectedRows()).map((r) => this.rowSelection(r)),
              patch: s,
              expected_revision: this.page.dataset_revision ?? this.page.revision,
              confirmation: this.operation === "delete" ? "DELETE" : "SAVE"
            });
          }
        }
        const t = this.generation, i = this.mutationEpoch;
        this.saving = !0, this.error = "", this.busy(), this.requestUpdate();
        try {
          if (this.operation === "new" ? await this.client.mutate(this.pending) : await this.client.databaseMutation(this.pending), t !== this.generation || i !== this.mutationEpoch)
            return;
          this.pending = void 0, this.saving = !1, this.operation = null, this.original = "", this.draft = {};
          for (const s of this.renderRoot.querySelectorAll(
            "#database-edit,#database-delete"
          ))
            s.close();
          this.notice = "Database change applied.", this.dispatchEvent(
            new CustomEvent("database-changed", {
              bubbles: !0,
              composed: !0
            })
          ), await this.load();
        } catch (s) {
          if (t !== this.generation || i !== this.mutationEpoch)
            return;
          [
            "invalid_request",
            "conflict",
            "not_found",
            "unauthorized",
            "busy",
            "backup_in_progress",
            "library_storage_limit"
          ].includes(g(s)) && (this.pending = void 0), this.fail(s);
        } finally {
          t === this.generation && i === this.mutationEpoch && (this.saving = !1, this.busy(), this.requestUpdate());
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
    return this.pending ? a`<div class="warning" role="alert">
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
        </div>` : l;
  }
  options() {
    return a`<dialog
      id="database-options"
      class="database-dialog"
      @click=${q}
    >
      <div class="card-head">
        <h2>Database options</h2>
        ${S(() => this.renderRoot.querySelector("#database-options")?.close())}
      </div>
      <p>View choices save automatically for your HA user.</p>
      <fieldset ?disabled=${this.blocked}>
        <label
          >Rows per page<select
            name="database_limit"
            .value=${this.fitPage ? "fit" : String(this.filters.limit)}
            @change=${(e) => {
      const t = e.target.value;
      this.fitPage = t === "fit", this.preferences?.set({
        limit: this.fitPage ? "fit" : Number(t)
      }), this.fitPage ? (this.scheduleFit(), this.requestUpdate()) : this.browse({ limit: Number(t) });
    }}
          >
            <option value="fit">Fit to screen</option>
            ${[10, 25, 100, 500].map((e) => a`<option value=${e}>${e}</option>`)}
          </select></label
        ><label class="check"
          ><input
            name="show_system"
            type="checkbox"
            .checked=${this.showSystem}
            @change=${(e) => {
      this.showSystem = e.target.checked, this.preferences?.set({ show_system: this.showSystem }), !this.showSystem && !ue.includes(this.table) && this.changeTable("viewings"), this.requestUpdate();
    }}
          />Show system tables</label
        >
      </fieldset>
      <p class="muted">
        IDs, relationship keys, managed paths, audit history, dataset metadata
        and write receipts remain protected.
      </p>
    </dialog>`;
  }
  render() {
    if (!this.ready)
      return a`<p>${this.error || "Loading database preferences…"}</p>
        ${this.error ? a`<button @click=${() => this.initialize()}>Retry loading database</button>` : l}`;
    const e = Object.keys(this.page?.tables ?? pe).filter(
      (i) => this.showSystem || ue.includes(i)
    ), t = (this.page?.schema ?? []).some((i) => i.editable);
    return a`<section class="card database" aria-label="Database management">
      <div class="entries-header">
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
              ${`Delete ${this.selected.size > 1 ? "entries" : "entry"}${this.selected.size ? ` (${this.selected.size})` : ""}`}</button
            ><button ?disabled=${this.blocked} @click=${() => this.load()}>
              Refresh database
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
          ></kaleidescape-transfers
          ><button
            class="database-options-button"
            ?disabled=${this.blocked}
            @click=${() => this.open("database-options")}
          >
            Options
          </button>
        </div>
        <div class="database-messages">
          ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}${this.notice ? a`<p role="status">${this.notice}</p>` : l}${this.preferenceError ? a`<p class="warning">${this.preferenceError}<button @click=${() => this.preferences?.retry()}>Retry preferences</button></p>` : l}${this.retry()}
        </div>
        <div
          class="page-tabs table-tabs"
          role="tablist"
          aria-label="Database tables"
          @keydown=${(i) => {
      const s = e.indexOf(this.table), r = i.key === "ArrowRight" ? (s + 1) % e.length : i.key === "ArrowLeft" ? (s + e.length - 1) % e.length : i.key === "Home" ? 0 : i.key === "End" ? e.length - 1 : -1;
      r >= 0 && !this.blocked && (i.preventDefault(), this.changeTable(e[r]), this.updateComplete.then(
        () => this.renderRoot.querySelector(`#table-${this.table}`)?.focus()
      ));
    }}
        >
          ${e.map((i) => a`<button role="tab" id=${`table-${i}`} aria-selected=${this.table === i} tabindex=${this.table === i ? 0 : -1} ?disabled=${this.blocked} @click=${() => this.changeTable(i)}>${pe[i] ?? i}${this.page ? ` (${this.page.tables[i]})` : ""}</button>`)}
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
            ><button
              slot="actions"
              ?disabled=${this.blocked}
              @click=${() => this.browse({ query: this.search })}
            >
              Search
            </button></kaleidescape-database-search
          >
          <label
            >Sort by<select
              name="database_sort"
              .value=${this.filters.sort ?? ""}
              @change=${(i) => this.browse({ sort: i.target.value })}
            >
              ${this.page?.columns.map((i) => a`<option value=${i}>${i}</option>`)}
            </select></label
          ><label
            >Order<button
              aria-label="Reverse database sort"
              @click=${() => this.browse({ descending: !this.filters.descending })}
            >
              ${this.filters.descending ? "Descending ↓" : "Ascending ↑"}
            </button></label
          >
        </div>
      </div>
      <div class="entries-layout">
        <section
          class="database-entries entries-list"
          aria-label="Database entries"
        >
          <div class="card-head">
            <h2>${pe[this.table] ?? this.table}</h2>
          </div>
          ${this.loading ? a`<p role="status">Loading database…</p>` : l}
          <ul class="entry-list" tabindex="0" aria-label="Database rows">
            ${this.page?.items.map(
      (i, s) => a`<li class=${this.detail === i ? "selected" : ""}>
                  ${this.page?.deletable ? a`<input
                          type="checkbox"
                          aria-label=${`Select ${String(i.title ?? i.name ?? i.id ?? i.cache_key ?? i.owner ?? "row")}`}
                          .checked=${this.selected.has(s)}
                          ?disabled=${this.blocked || this.selected.size >= 100 && !this.selected.has(s)}
                          @change=${(r) => {
        r.target.checked ? this.selected.add(s) : this.selected.delete(s), this.requestUpdate();
      }}
                        />` : l}<button
                    class="link entry-name"
                    title=${String(i.title ?? i.name ?? i.id ?? "Database entry")}
                    ?disabled=${this.blocked}
                    @click=${() => this.showDetail(i)}
                  >
                    ${String(i.title ?? i.name ?? i.id ?? i.cache_key ?? i.owner ?? i.request_id ?? "Dataset metadata")}
                  </button>
                </li>`
    )}
          </ul>
        </section>
        <section
          class="database-detail entries-detail"
          aria-label="Selected database entry"
          tabindex="0"
        >
          <div class="card-head">
            <h2>Entry details</h2>
            ${this.detail ? a`<button ?disabled=${this.blocked || !t} @click=${this.edit}>Edit entry</button>` : l}
            ${this.detail && ["purchase_records", "purchase_repair_events"].includes(
      this.table
    ) ? a`<button
                    ?disabled=${this.blocked}
                    @click=${() => {
      this.repairing = !0, this.requestUpdate();
    }}
                  >
                    ${this.table === "purchase_records" ? "Repair purchase" : "Review reversal"}
                  </button>` : l}
          </div>
          ${this.detail ? a`${(this.table === "library_artwork" || this.table === "library") && (this.detail.cache_key || this.detail.artwork_key) ? a`<div class="database-preview">
                            <kaleidescape-library-cover
                              .client=${this.client}
                              .scope=${this.scope}
                              .queue=${this.covers}
                              .artworkKey=${String(this.detail.cache_key ?? this.detail.artwork_key)}
                              .title=${String(this.detail.title ?? "Database artwork")}
                            ></kaleidescape-library-cover>
                          </div>
                          ${this.scope?.library_enabled ? l : a`<small>Enable Library to preview cached artwork.</small>`}` : l}
                  <div class="database-references">
                    ${(this.page?.references ?? []).filter((i) => Object.values(i.key).every((s) => this.detail?.[s] != null)).map((i) => a`<button class="link" ?disabled=${this.blocked} @click=${() => this.follow(i)}>Open ${pe[i.table] ?? i.table} · ${Object.values(i.key).join(", ")}</button>`)}
                  </div>
                  <pre>${JSON.stringify(this.detail, null, 2)}</pre>
                  ${this.repairing && ["purchase_records", "purchase_repair_events"].includes(
      this.table
    ) ? a`<kaleidescape-purchase-repair
                          .client=${this.client}
                          .scope=${this.scope}
                          .row=${this.detail}
                          .token=${this.rowSelection(this.detail).token}
                          .reverse=${this.table === "purchase_repair_events"}
                          @repair-cancel=${() => {
      this.repairing = !1, this.requestUpdate();
    }}
                          @repair-busy=${(i) => {
      this.repairPending = i.detail, this.busy();
    }}
                          @repair-complete=${() => {
      this.repairing = !1, this.repairPending = !1, this.busy(), this.detail = void 0, this.notice = "Purchase repair applied.", this.dispatchEvent(
        new CustomEvent("database-changed", {
          bubbles: !0,
          composed: !0
        })
      ), this.load();
    }}
                          @access-denied=${() => this.fail({ code: "unauthorized" })}
                        ></kaleidescape-purchase-repair>` : l}
                  ${t ? l : a`<p class="muted">This table protects system integrity; stored values are read-only.</p>`}` : a`<p class="empty">
                  Select an entry to inspect raw values.
                </p>`}
        </section>
      </div>
      <footer class="entries-footer">
        <span
          >${pe[this.table] ?? this.table} · ${this.page?.total ?? 0} total
          · Revision ${this.page?.dataset_revision ?? 0}</span
        >
        ${this.page ? a`<div class="pagination database-pagination">
                <small
                  >${this.page.items.length === 1 ? "Row" : "Rows"}
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
              </div>` : l}
      </footer>
      ${this.options()}
      <dialog
        id="database-edit"
        class="database-dialog"
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.operation === "new" ? "New viewing" : "Edit database entry"}
          </h2>
          ${S((i) => this.close(i))}
        </div>
        <p class="warning">
          Only supported fields can change. Source metadata may be restored by a
          later sync. Open playback sessions and their viewings are protected
          until closed. Session corrections do not recalculate viewing
          summaries.
        </p>
        ${this.error ? a`<p class="error">${this.error}</p>` : l}${this.retry()}
        <form @submit=${this.save}>
          <fieldset ?disabled=${this.saving || !!this.pending}>
            ${this.operation === "new" ? a`<kaleidescape-manual-viewing
                    .fuzzySearch=${this.fuzzySearch}
                    .client=${this.client}
                    .scope=${this.scope}
                    .draft=${this.createDraft}
                    .disabled=${this.saving || !!this.pending}
                    @draft-change=${(i) => {
      this.createDraft = i.detail, this.requestUpdate();
    }}
                    @access-denied=${() => this.fail(new v("unauthorized"))}
                  ></kaleidescape-manual-viewing>` : (this.page?.schema ?? []).filter((i) => i.editable).map(
      (i) => a`<div class="database-edit-field">
                          <label
                            >${i.name}${i.type === "json" || i.name === "notes" ? a`<textarea
                                    name=${i.name}
                                    .value=${this.nulls.has(i.name) ? "" : this.draft[i.name] ?? ""}
                                    placeholder=${this.nulls.has(i.name) ? "NULL · type to set a value" : ""}
                                    @input=${(s) => {
        this.nulls.delete(i.name), this.requestUpdate(), this.draft = {
          ...this.draft,
          [i.name]: s.target.value
        };
      }}
                                  ></textarea>` : a`<input
                                    name=${i.name}
                                    type=${i.type === "number" ? "number" : "text"}
                                    step="any"
                                    .value=${this.nulls.has(i.name) ? "" : this.draft[i.name] ?? ""}
                                    placeholder=${this.nulls.has(i.name) ? "NULL · type to set a value" : ""}
                                    @input=${(s) => {
        this.nulls.delete(i.name), this.requestUpdate(), this.draft = {
          ...this.draft,
          [i.name]: s.target.value
        };
      }}
                                  />`}</label
                          >${i.nullable ? a`<label class="check"
                                  ><input
                                    type="checkbox"
                                    aria-label=${`Set ${i.name} to NULL`}
                                    .checked=${this.nulls.has(i.name)}
                                    @change=${(s) => {
        s.target.checked ? this.nulls.add(i.name) : this.nulls.delete(i.name), this.requestUpdate();
      }}
                                  />NULL</label
                                >` : l}
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
            >
          </fieldset>
          <div class="dialog-footer">
            <button
              type="submit"
              class="primary"
              ?disabled=${!this.confirmed || this.saving || !!this.pending}
            >
              Save changes
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        id="database-delete"
        class="database-dialog"
        @click=${q}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            Permanently delete
            ${k(this.selectedRows().length, "entry", "entries")}?
          </h2>
          ${S((i) => this.close(i))}
        </div>
        <p>
          Database deletion is permanent. Associated memberships/session
          references may also be removed, and artwork references cleared. Source
          sync may recreate cached library records. Existing exports and backups
          remain.
        </p>
        ${this.error ? a`<p class="error">${this.error}</p>` : l}${this.retry()}<label
          >Type DELETE to confirm<input
            name="delete_confirmation"
            .value=${this.deleteWord}
            ?disabled=${!!this.pending || this.saving}
            @input=${(i) => {
      this.deleteWord = i.target.value, this.requestUpdate();
    }}
        /></label>
        <div class="dialog-footer">
          <button
            class="danger"
            ?disabled=${this.deleteWord !== "DELETE" || this.saving || !!this.pending}
            @click=${() => this.save()}
          >
            Confirm delete
          </button>
        </div>
      </dialog>
    </section>`;
  }
};
ft.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, ft.styles = [E, Li, ar];
let gi = ft;
customElements.get("kaleidescape-database") || customElements.define("kaleidescape-database", gi);
function rr(n, e, t) {
  return a`<button
    type="button"
    class="view-mode-pill"
    role="switch"
    aria-label="Advanced view"
    aria-checked=${n}
    title=${n ? "Switch to Basic view" : "Switch to Advanced view"}
    ?disabled=${e}
    @click=${t}
  >
    <span class="mode-track" aria-hidden="true"
      ><span class="mode-thumb"></span></span
    ><span class="mode-label">Adv</span>
  </button>`;
}
const Lt = [
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
], mt = class mt extends x {
  constructor() {
    super(), this.narrow = !1, this.api = null, this.generation = 0, this.mutationEpoch = 0, this.listRequest = 0, this.detailRequest = 0, this.info = null, this.rows = [], this.selected = null, this.editMovieId = null, this.editTitleTouched = !1, this.draft = null, this.initial = null, this.manual = null, this.manualInitial = "", this.sort = "completed_at", this.descending = !0, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.journalReady = !1, this.sessions = null, this.sessionError = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.nextCursor = null, this.history = [], this.page = 1, this.loading = !1, this.detailLoading = !1, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.error = "", this.lastError = "", this.notice = "", this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = !1, this.maintenanceBusy = !1, this.advancedView = !0, this.modeReady = !1, this.modeScope = "", this.modeError = "", this.controlLocked = !1, this.locationChanged = () => {
      this.navigationReady && this.advancedView && this.info?.permissions.edit && this.info.library_enabled && this.activePage !== "library" && Se() && je(void 0, !0) && this.switchPage("library");
    }, Ai(this), Ce(this, () => {
      const e = this.renderRoot.querySelector(
        "kaleidescape-reader"
      );
      return !this.info?.permissions.edit || !this.modeReady || this.loading || this.saving || this.pending || this.settingsBusy || this.maintenanceBusy || this.controlLocked || this.dirty() || this.hasOpenDialog() || this.modePreferences?.unsettled || !(e?.confirmNavigation() ?? !0) ? !1 : (this.modePreferences?.dispose(), this.modePreferences = void 0, this.modeReady = !1, this.refresh(), !0);
    });
  }
  modeControl(e = !1) {
    return a`<div class="mode-control" slot="view-mode">
      ${rr(this.advancedView, e, () => {
      this.changeMode();
    })}
      ${this.modeError ? a`<small role="alert">Mode preference did not save. <button @click=${() => this.modePreferences?.retry()}>Retry</button></small>` : l}
    </div>`;
  }
  hasOpenDialog(e = this.renderRoot, t = !1) {
    return [...e.querySelectorAll("*")].some(
      (i) => i instanceof HTMLDialogElement && i.open && (!t || i.hasAttribute("data-admin-dialog")) || i.shadowRoot && this.hasOpenDialog(i.shadowRoot, t)
    );
  }
  async changeMode() {
    if (!this.info?.permissions.edit || !this.modeReady || this.loading || this.saving || this.pending || this.maintenanceBusy || this.settingsBusy || this.controlLocked)
      return;
    const e = this.renderRoot.querySelector(
      "kaleidescape-reader"
    ), t = !this.advancedView, i = !t && (["database", "settings"].includes(this.activePage) || this.hasOpenDialog(this.renderRoot, !0));
    (this.advancedView ? !this.discard() : !(e?.confirmNavigation() ?? !0)) || (this.generation++, this.listRequest++, this.detailRequest++, this.closeEditor(), this.rows = [], this.selected = this.sessions = null, this.cursor = void 0, this.history = [], this.nextCursor = null, this.page = 1, this.journalReady = !1, this.error = this.notice = "", i && (this.activePage = Gt(
      this.info.ui_defaults?.default_landing_page,
      !1,
      !!this.info.library_enabled,
      !1
    )), H(this.activePage), this.advancedView = t, this.modePreferences?.set({ advanced_view: t }), this.requestUpdate(), t && await this.loadList(), await this.updateComplete, this.renderRoot.querySelector(".view-mode-pill")?.focus());
  }
  willUpdate(e) {
    if (!(!e.has("hass") && !e.has("client")))
      if (this.hass) {
        if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
          this.bind(null);
          return;
        }
        (this.haConnection !== this.hass.connection || this.haUser !== this.hass.user.id) && (this.haConnection = this.hass.connection, this.haUser = this.hass.user.id, this.haClient = new ki({
          callWS: (t) => this.hass.callWS(t),
          fetchWithAuth: (t, i) => this.hass.fetchWithAuth(t, i)
        })), this.bind(this.haClient);
      } else
        this.bind(this.client ?? null);
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("location-changed", this.locationChanged), window.addEventListener("popstate", this.locationChanged), this.unwatchMovieDialog = Ei(() => {
      I() && this.selected && (this.movieSelectionId = this.selected.id), this.requestUpdate();
    }), this.requestUpdate("hass"), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener("location-changed", this.locationChanged), window.removeEventListener("popstate", this.locationChanged), this.unwatchMovieDialog?.(), this.unwatchMovieDialog = void 0, this.bind(null);
  }
  clearPrivate() {
    this.modePreferences?.dispose(), this.modePreferences = void 0, this.modeScope = this.modeError = "", this.modeReady = this.controlLocked = !1, this.advancedView = !0, this.manual = null, this.manualInitial = "", this.sort = "completed_at", this.descending = !0, this.generation++, this.info = null, this.rows = [], this.selected = null, this.editMovieId = null, this.editTitleTouched = !1, this.draft = null, this.initial = null, this.sessions = null, this.pending = null, this.history = [], this.nextCursor = null, this.cursor = void 0, this.page = 1, this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.confirmDelete = !1, this.saving = !1, this.loading = !1, this.detailLoading = !1, this.sessionError = "", this.notice = "", this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = this.maintenanceBusy = !1, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.calendarStatus = void 0, this.journalMovie = void 0, this.libraryTitleId = void 0, this.libraryCriterion = void 0, this.journalReady = !1;
  }
  bind(e) {
    this.api !== e && (this.clearPrivate(), this.api = e, this.error = "", this.requestUpdate(), e && this.refresh());
  }
  fail(e) {
    g(e) === "unauthorized" && this.clearPrivate(), this.lastError = g(e), this.error = y(e), this.requestUpdate();
  }
  dirty() {
    return this.manual ? JSON.stringify(this.manual) !== this.manualInitial : this.draft && (this.editTitleTouched || JSON.stringify(this.draft) !== JSON.stringify(this.initial));
  }
  discard() {
    return (!this.dirty() || window.confirm("Discard your unsaved changes?")) && (this.activePage !== "library" || (this.renderRoot.querySelector("kaleidescape-library")?.confirmNavigation() ?? !0)) && (this.activePage !== "database" || (this.renderRoot.querySelector("kaleidescape-database")?.confirmNavigation() ?? !0)) && (this.activePage !== "settings" || (this.renderRoot.querySelector("kaleidescape-settings")?.confirmNavigation() ?? !0));
  }
  async switchPage(e, t) {
    e === "library" && !this.info?.library_enabled || e === this.activePage && !(e === "journal" && this.journalMovie) || this.loading || this.saving || this.pending || this.maintenanceBusy || this.settingsBusy || this.controlLocked || !this.discard() || (this.closeEditor(), this.libraryTitleId = t?.libraryTitleId, this.libraryCriterion = t?.libraryCriterion, e === "journal" && (this.journalMovie = t?.movie, this.query = this.searchText = "", this.status = this.filterStatus = ""), this.activePage = e, H(e), this.error = this.notice = "", this.requestUpdate(), e === "journal" && (this.page = 1, this.history = [], await this.loadList()));
  }
  pageKey(e) {
    const t = Lt.filter(
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
      for (let o = 0; e && !s.length && o < 20; o++) {
        if (await new Promise((d) => setTimeout(d, 500)), i !== this.generation) return;
        ({ entries: s } = await t.info());
      }
      if (i !== this.generation) return;
      if (!s.length) throw new v("not_ready");
      if (s[0].api_version !== 1) throw new v("not_ready");
      if (this.info = s[0], !this.info.permissions.edit) return;
      const r = `${this.info.entry_id}:${this.info.dataset_id}`;
      if (!this.modePreferences || !this.modeReady || this.modeScope !== r) {
        this.modeReady = !1, this.modePreferences?.dispose();
        const o = new O(
          t,
          this.info,
          !1,
          (c) => {
            this.modePreferences === o && (this.modeError = c ? y(c) : "", this.requestUpdate());
          },
          "interface"
        );
        this.modePreferences = o, this.modeScope = r;
        const d = await o.load();
        if (i !== this.generation) return;
        this.advancedView = d.advanced_view === !0, this.modeReady = !0;
      }
      this.navigationReady || (this.activePage = Gt(
        this.info.ui_defaults?.default_landing_page,
        !0,
        !!this.info.library_enabled
      ), this.navigationReady = !0, H(this.activePage)), this.activePage === "library" && !this.info.library_enabled && (this.activePage = "journal", H(this.activePage)), this.history = [], this.cursor = void 0, this.page = 1, this.advancedView && await this.loadList();
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async loadList(e) {
    if (!this.api || !this.info) return;
    const t = this.api, i = this.info, s = this.generation, r = ++this.listRequest;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const o = await t.list(
        i,
        this.query,
        this.status,
        e,
        this.sort,
        this.descending,
        this.fuzzySearch,
        this.journalMovie?.id
      );
      if (s !== this.generation || r !== this.listRequest)
        return;
      this.rows = o.items, this.cursor = e, this.nextCursor = o.next_cursor, this.info = { ...this.info, revision: o.revision };
    } catch (o) {
      s === this.generation && r === this.listRequest && (this.rows = [], this.nextCursor = null, this.fail(o));
    } finally {
      s === this.generation && r === this.listRequest && (this.loading = !1, this.requestUpdate());
    }
  }
  selectJournalEntry(e) {
    return this.selectRecord(e, !0);
  }
  async selectRecord(e, t = !1) {
    if (!this.api || !this.info || this.pending || !this.discard()) return;
    this.closeEditor(), this.movieSelectionId = t ? e : void 0;
    const i = this.api, s = this.info, r = this.generation, o = ++this.detailRequest;
    this.detailLoading = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const d = await i.get(s, e);
      if (r !== this.generation || o !== this.detailRequest)
        return;
      this.selected = d, this.draft = this.initial = null, this.timingAnchor = void 0, this.detailLoading = !1, this.requestUpdate();
      try {
        const c = await i.sessions(s, e);
        r === this.generation && o === this.detailRequest && (this.sessions = c);
      } catch (c) {
        r === this.generation && o === this.detailRequest && (g(c) === "unauthorized" ? this.fail(c) : this.sessionError = "Session details could not be loaded.");
      }
    } catch (d) {
      r === this.generation && o === this.detailRequest && this.fail(d);
    } finally {
      r === this.generation && o === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  closeEditor() {
    this.timingAnchor = void 0, this.renderRoot.querySelectorAll("dialog").forEach((e) => e.close()), this.manual = null, this.manualInitial = "", this.detailRequest++, this.selected = null, this.editMovieId = null, this.editTitleTouched = !1, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.confirmDelete = !1, this.detailLoading = !1;
  }
  newRecord() {
    this.pending || !this.discard() || (this.closeEditor(), this.draft = rs(), this.initial = { ...this.draft }, this.manual = Ie(), this.manualInitial = JSON.stringify(this.manual), this.error = "", this.notice = "", this.requestUpdate(), this.updateComplete.then(async () => {
      this.renderRoot.querySelector("#journal-editor")?.showModal();
      const e = this.renderRoot.querySelector(
        "kaleidescape-manual-viewing"
      );
      await e?.updateComplete;
      const t = e?.shadowRoot?.querySelector(
        "kaleidescape-library-title-picker"
      );
      await t?.updateComplete, t?.shadowRoot?.querySelector("input")?.focus();
    }));
  }
  input(e, t) {
    this.draft && (this.draft = Ja(
      this.draft,
      e,
      t.target.value,
      this.timingAnchor ?? this.draft
    ), Number.isFinite(new Date(this.draft.started_at).getTime()) ? this.timingAnchor = {
      started_at: this.draft.started_at,
      ended_at: this.draft.ended_at
    } : e === "ended_at" && this.timingAnchor && (this.timingAnchor = {
      ...this.timingAnchor,
      ended_at: this.draft.ended_at
    }), this.requestUpdate());
  }
  async save(e) {
    if (e.preventDefault(), !(!this.api || !this.info || !this.draft || this.pending || this.saving || !e.target.reportValidity())) {
      if (!this.manual && this.editTitleTouched && !this.editMovieId) {
        this.error = "Select a Library movie from the suggestions.", this.requestUpdate();
        return;
      }
      try {
        const i = this.manual ? Ds(this.manual) : {
          ...Ha(this.draft, this.selected ? this.initial : void 0),
          ...this.editTitleTouched ? { library_title_id: this.editMovieId } : {}
        };
        if (this.manual || delete i.title, this.selected && !Object.keys(i).length) {
          this.notice = "There are no changes to save.", this.requestUpdate();
          return;
        }
        if ("ended_at" in i && i.ended_at && i.started_at && i.ended_at < i.started_at) {
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
        g(i) === "request_id_unavailable" ? this.fail(i) : (this.error = this.manual && i instanceof Error ? i.message : "Check the dates and numeric fields before saving.", this.requestUpdate());
      }
    }
  }
  async deleteRecord() {
    if (!(!this.api || !this.info || !this.selected || this.pending))
      try {
        this.pending = this.api.prepare(this.info, "delete", {
          viewing_id: this.selected.id,
          expected_revision: this.selected.revision
        }), await this.commit();
      } catch (e) {
        this.fail(e);
      }
  }
  async commit() {
    if (!this.api || !this.pending || this.saving) return;
    const e = this.api, t = this.pending, i = this.generation, s = this.mutationEpoch;
    this.saving = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const r = await e.mutate(t);
      if (i !== this.generation || s !== this.mutationEpoch)
        return;
      this.pending = null, this.closeEditor(), this.notice = r.viewing.deleted_at ? "Entry removed from the journal. Stored history is retained." : "Entry saved.", r.viewing.deleted_at || (this.selected = r.viewing, this.manual = null), this.page = 1, this.history = [], await this.loadList();
      try {
        const { entries: o } = await e.info();
        i === this.generation && s === this.mutationEpoch && o[0]?.dataset_id === this.info?.dataset_id && (this.info = o[0]);
      } catch (o) {
        i === this.generation && s === this.mutationEpoch && this.fail(o);
      }
    } catch (r) {
      if (i !== this.generation || s !== this.mutationEpoch)
        return;
      ["invalid_request", "conflict", "unauthorized"].includes(
        g(r)
      ) && (this.pending = null), this.fail(r);
    } finally {
      i === this.generation && s === this.mutationEpoch && (this.saving = !1, this.requestUpdate());
    }
  }
  async inspectJournal() {
    this.saving || !this.pending || window.confirm(
      "This change may already have committed. Discard its retry and inspect the journal before adding it again?"
    ) && (this.pending = null, this.closeEditor(), this.notice = "Retry discarded. Check the journal before recreating the change.", await this.refresh());
  }
  date(e) {
    return e ? new Date(e).toLocaleString(void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    }) : "—";
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
    return this.detailLoading ? a`<div class="empty" role="status">Loading entry…</div>` : this.draft ? a`<form class="editor" @submit=${this.save}>
      <fieldset ?disabled=${this.saving || !!this.pending}>
        ${this.manual ? a`<kaleidescape-manual-viewing
                .client=${this.api}
                .scope=${this.info}
                .draft=${this.manual}
                .fuzzySearch=${this.fuzzySearch}
                .disabled=${this.saving || !!this.pending}
                @draft-change=${(e) => {
      this.manual = e.detail, this.requestUpdate();
    }}
                @access-denied=${() => this.fail(new v("unauthorized"))}
              ></kaleidescape-manual-viewing>` : _a(
      this.draft,
      (e, t) => this.input(e, t),
      a`<kaleidescape-library-title-picker
                    .client=${this.api}
                    .scope=${this.info}
                    .initialTitle=${this.initial?.title ?? ""}
                    .value=${this.editMovieId ?? ""}
                    .requireRuntime=${!1}
                    .fuzzySearch=${this.fuzzySearch}
                    .disabled=${this.saving || !!this.pending || !this.info?.library_enabled}
                    @title-selection=${(e) => {
        this.draft && (this.editTitleTouched = !0, this.editMovieId = e.detail.movie?.id ?? null, this.draft = { ...this.draft, title: e.detail.query }, this.requestUpdate());
      }}
                    @access-denied=${() => this.fail(new v("unauthorized"))}
                  ></kaleidescape-library-title-picker>
                  <small
                    >Selecting a different movie keeps the recorded times and
                    watched minutes. Adjust those fields separately if
                    needed.</small
                  >
                  ${this.info?.library_enabled ? l : a`<small>Enable Library to change the movie. Existing timing and notes can still be corrected.</small>`}`
    )}
        ${this.selected?.origin === "observed" ? a`<small>Only fields you change are marked as manual corrections. Session evidence is retained.</small>` : l}
        <div class="actions dialog-footer">
          ${this.selected && !this.manual ? a`<button type="button" class="danger delete-viewing" @click=${this.openDelete}>Delete entry</button>` : l}
          <button type="submit" class="primary">
            ${this.saving ? "Saving…" : this.selected ? "Save changes" : "Add entry"}
          </button>
        </div>
      </fieldset>
    </form>` : a`<div class="empty">
        <strong>Select an entry</strong>
        <p>Review its details, make corrections, or add a manual viewing.</p>
      </div>`;
  }
  async editCalendarViewing(e) {
    if (!this.info?.permissions.edit || this.activePage !== "journal" || this.journalView !== "calendar" || this.loading || this.saving || this.pending || this.detailLoading)
      return;
    const t = this.generation, i = this.selectRecord(e), s = this.detailRequest;
    await i, t === this.generation && s === this.detailRequest && this.selected?.id === e && !this.draft && this.info?.permissions.edit && this.editRecord();
  }
  async editLinkedViewing(e, t) {
    if (!this.advancedView || !this.info?.permissions.edit || this.loading || this.saving || this.pending || this.detailLoading || this.maintenanceBusy || this.settingsBusy || this.controlLocked)
      return;
    const i = this.generation, s = this.activePage, r = this.selectRecord(e), o = this.detailRequest;
    await r, t.isConnected && i === this.generation && o === this.detailRequest && s === this.activePage && this.advancedView && this.info?.permissions.edit && this.selected?.id === e && !this.draft && this.editRecord();
  }
  editRecord() {
    !this.selected || this.pending || this.saving || (this.draft = rs(this.selected), this.timingAnchor = {
      started_at: this.draft.started_at,
      ended_at: this.draft.ended_at
    }, this.editMovieId = null, this.editTitleTouched = !1, this.initial = { ...this.draft }, this.error = this.notice = "", this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector("#journal-editor")?.showModal()
    ));
  }
  async reloadSelected() {
    if (!this.selected) return;
    const e = this.selected.id, t = !!this.draft;
    await this.selectRecord(e), t && this.selected?.id === e && !this.draft && this.editRecord();
  }
  cancelEdit(e) {
    e?.preventDefault(), !(!this.saving && !this.pending && !this.discard()) && (this.mutationEpoch++, this.saving = !1, this.pending = null, this.draft = this.initial = null, this.editMovieId = null, this.editTitleTouched = !1, this.manual = null, this.manualInitial = "", this.renderRoot.querySelector("#journal-editor")?.close(), this.requestUpdate());
  }
  openDelete() {
    !this.selected || this.saving || this.pending || !this.discard() || (this.confirmDelete = !0, this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector("#journal-delete")?.showModal()
    ));
  }
  cancelDelete(e) {
    e?.preventDefault(), this.mutationEpoch++, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.renderRoot.querySelector("#journal-delete")?.close(), this.requestUpdate();
  }
  renderEvidence() {
    return a`
      ${this.selected ? a`<details>
              <summary>Record details & sessions</summary>
              <div class="metadata">
                Record ${this.selected.id}<br />Origin: ${this.selected.origin}
                · Revision ${this.selected.revision}<br />Updated
                ${this.date(this.selected.updated_at)}<br />Completion:
                ${this.selected.completion_reason ?? "Not completed"}
              </div>
              ${this.sessionError ? a`<p>${this.sessionError}</p>` : this.sessions ? this.sessions.items.length ? a` ${this.sessions.items.map((e) => a`<div class="session">${this.date(e.started_at)}<br />${(e.watched_seconds / 60).toFixed(2)} min watched · ${e.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${k(e.gap_count, "timing gap")}<br />${e.end_reason ?? "Open session"}</div>`)}
                        ${this.sessions.has_more ? a`<small>Showing the latest 100 sessions.</small>` : l}` : a`<p class="muted">
                          No recorded sessions for this entry.
                        </p>` : a`<p class="muted">
                        Session details have not been loaded. Reopen the entry
                        to load them.
                      </p>`}
            </details>` : l}
    `;
  }
  clearJournalSearch() {
    this.query = this.searchText = "", this.page = 1, this.history = [], this.loadList(), this.requestUpdate();
  }
  renderJournal() {
    const e = this.journalView === "calendar" && !this.query.trim(), t = this.loading || this.saving || !!this.pending;
    return a`<section
      class=${`card journal${e ? " journal-calendar-mode" : ""}`}
      aria-label="Journal"
    >
      <div class="entries-header">
        ${e ? a`<kaleidescape-journal-shortcuts
                .context=${this.api}
                .scopeKey=${`${this.info?.entry_id}:${this.info?.dataset_id}`}
                .value=${this.searchText}
                .disabled=${t}
                .allowAdd=${!0}
                .filtered=${!!this.status || !!this.journalMovie}
                .filterLabel=${this.journalMovie ? `Viewings for ${this.journalMovie.title}` : ""}
                @journal-search=${(i) => {
      this.query = this.searchText = i.detail.trim(), this.page = 1, this.history = [], this.loadList();
    }}
                @journal-add=${this.newRecord}
                @journal-clear-movie=${() => this.switchPage("journal")}
                @journal-open-options=${() => this.renderRoot.querySelector("kaleidescape-journal-options")?.open()}
              ></kaleidescape-journal-shortcuts>` : l}
        ${this.journalMovie ? a`<p class="journal-movie-filter">Viewings for ${this.journalMovie.title} <button ?disabled=${t} @click=${() => this.switchPage("journal")}>Show all viewings</button></p>` : l}
        ${this.query.trim() ? a`<button type="button" class="journal-search-chip" aria-label=${`Clear search: ${this.query}`} ?disabled=${t} @click=${this.clearJournalSearch}><span>${this.query}</span><span aria-hidden="true">×</span></button>` : l}
        <form
          class="filters journal-filters"
          @submit=${(i) => {
      i.preventDefault(), this.query = this.searchText = this.searchText.trim(), this.status = this.filterStatus, this.page = 1, this.history = [], this.loadList();
    }}
        >
          <label
            >Search titles<span class="journal-search-input"
              ><input
                name="search"
                type="search"
                maxlength="500"
                .value=${this.searchText}
                ?disabled=${t}
                @input=${(i) => {
      this.searchText = i.target.value, !this.searchText && this.query && this.clearJournalSearch();
    }}
              />${this.query.trim() ? a`<button type="button" class="journal-clear-search" aria-label="Clear Journal search" title="Clear search" ?disabled=${t} @click=${this.clearJournalSearch}>×</button>` : l}</span
            ></label
          >
          <div class="journal-filter-tools">
            <label ?hidden=${e}
              >Sort by<select
                name="journal_sort"
                .value=${this.sort}
                ?disabled=${t}
                @change=${(i) => {
      this.sort = i.target.value, this.page = 1, this.history = [], this.loadList();
    }}
              >
                <option value="completed_at">
                  Completed date · partial first
                </option>
                <option value="title">Title</option>
              </select></label
            >
            <button
              type="button"
              ?hidden=${e}
              ?disabled=${t}
              @click=${() => {
      this.descending = !this.descending, this.page = 1, this.history = [], this.loadList();
    }}
            >
              ${this.descending ? "Descending ↓" : "Ascending ↑"}
            </button>
          </div>
          <button class="journal-search-button" ?disabled=${t}>
            Search
          </button>
          <div class="journal-toolbar">
            <button
              type="button"
              class="primary"
              ?disabled=${t || !this.journalReady}
              @click=${this.newRecord}
            >
              ＋ Add viewing
            </button>
            <button
              type="button"
              ?disabled=${t}
              @click=${() => this.refresh()}
            >
              Refresh
            </button>
            <kaleidescape-journal-options
              .mobileCompact=${e}
              @journal-refresh=${() => this.refresh()}
              .status=${this.status}
              @journal-status=${(i) => {
      this.status = this.filterStatus = i.detail, this.page = 1, this.history = [], this.loadList(), this.requestUpdate();
    }}
              .client=${this.api}
              .scope=${this.info}
              .disabled=${t}
              @access-denied=${() => this.fail(new v("unauthorized"))}
              @journal-options=${(i) => {
      this.journalReady = !0, this.journalView = i.detail.view, this.calendarSize = i.detail.calendar_size, this.calendarFit = i.detail.calendar_fit;
      const s = this.fuzzySearch !== i.detail.fuzzy_search;
      this.fuzzySearch = i.detail.fuzzy_search, s && (this.history = [], this.page = 1, this.loadList()), this.requestUpdate();
    }}
            ></kaleidescape-journal-options>
          </div>
        </form>
      </div>
      ${e ? a`<kaleidescape-journal-calendar
              @calendar-status=${(i) => {
      this.calendarStatus = i.detail, this.requestUpdate();
    }}
              .client=${this.api ?? void 0}
              .scope=${this.info ?? void 0}
              .query=${this.query}
              .status=${this.status}
              .fuzzy=${this.fuzzySearch}
              .libraryTitleId=${this.journalMovie?.id}
              .daySize=${this.calendarSize}
              .fitScreen=${this.calendarFit}
              .disabled=${t || this.detailLoading}
              .editable=${!0}
              @edit-viewing=${(i) => this.editCalendarViewing(i.detail)}
              @browse-library=${(i) => this.switchPage("library", { libraryCriterion: i.detail })}
              @access-denied=${() => this.fail(new v("unauthorized"))}
            ></kaleidescape-journal-calendar>` : a`
              <div class="entries-layout">
                <section class="entries-list" aria-label="Journal entries">
                  <div class="card-head">
                    <h2>Viewings (${this.info?.viewing_count ?? 0})</h2>
                  </div>
                  ${this.loading ? a`<div class="empty" role="status">
                          Loading viewings…
                        </div>` : this.rows.length ? a`<ul
                            class="entry-list"
                            tabindex="0"
                            aria-label="Viewings"
                          >
                            ${this.rows.map((i) => ms(i, this.selected?.id, (s) => {
      this.selectJournalEntry(s);
    }, this.saving || !!this.pending))}
                          </ul>` : a`<div class="empty">
                            <strong
                              >${this.query || this.status ? "No matching viewings" : "Your journal is empty"}</strong
                            >
                            <p>
                              ${this.query || this.status ? "Try another title or status." : "Add a manual viewing or enable automatic tracking in the integration settings."}
                            </p>
                          </div>`}
                </section>
                <section
                  class="entries-detail"
                  aria-label="Viewing details"
                  tabindex="0"
                >
                  <div class="card-head">
                    <h2>Viewing details</h2>
                    ${this.selected ? a`<button ?disabled=${t} @click=${this.editRecord}>Edit viewing</button><button class="danger" ?disabled=${t} @click=${this.openDelete}>Delete entry</button>` : l}
                  </div>
                  ${this.detailLoading ? a`<div class="empty" role="status">
                          Loading entry…
                        </div>` : this.selected ? a`${bs(
      this.selected,
      (i) => this.date(i),
      !t && this.linkedViewingId === this.selected.id ? () => this.renderRoot.querySelector(
        "kaleidescape-viewing-library"
      )?.openLibrary() : void 0
    )}
                            <kaleidescape-viewing-library
                              .client=${this.api}
                              .scope=${this.info}
                              .viewingId=${this.selected.id}
                              .autoOpen=${I() && this.movieSelectionId === this.selected.id}
                              @viewing-library-link=${(i) => {
      if (this.selected?.id !== i.detail.viewingId)
        return;
      const s = i.detail.linked ? i.detail.viewingId : void 0;
      this.linkedViewingId !== s && (this.linkedViewingId = s, this.requestUpdate());
    }}
                              .disabled=${t}
                              .advanced=${!0}
                              @access-denied=${() => this.fail(new v("unauthorized"))}
                              @browse-library=${(i) => this.switchPage("library", { libraryCriterion: i.detail })}
                            ></kaleidescape-viewing-library>
                            ${this.selected.notes ? a`<h3>Notes</h3>
                                    <p class="journal-notes">
                                      ${this.selected.notes}
                                    </p>` : l}
                            ${this.renderEvidence()}` : a`<div class="empty">
                            <strong>Select an entry</strong>
                            <p>Review its details or add a manual viewing.</p>
                          </div>`}
                </section>
              </div>
            `}
      <footer class="entries-footer journal-status">
        <span>
          ${$i(this.info, e ? this.calendarStatus : void 0, e)}
          <span class="journal-system-details"
            >· ${this.bytes(this.info?.database_bytes ?? 0)} /
            ${this.bytes(this.info?.database_limit_bytes ?? 0)} database ·
            Recording:
            ${this.info?.tracking_enabled ? "Enabled" : "Manual only"} ·
            ${this.info?.backup_in_progress ? "Backing up" : "Storage ready"} ·
            Schema ${this.info?.schema_version} · Revision
            ${this.info?.revision}</span
          > </span
        >${e ? Ci(this.calendarStatus, () => {
      this.renderRoot.querySelector(
        "kaleidescape-journal-calendar"
      )?.refresh();
    }) : l}

        <div class="pagination" ?hidden=${e}>
          <small>Page ${this.page} · Up to 25 entries</small>
          <div class="actions">
            <button
              ?disabled=${t || this.page === 1}
              @click=${() => {
      this.page = 1, this.history = [], this.loadList();
    }}
            >
              First
            </button>
            <button
              ?disabled=${t || !this.history.length}
              @click=${() => {
      this.page--, this.loadList(this.history.pop());
    }}
            >
              Previous
            </button>
            <button
              ?disabled=${t || !this.nextCursor}
              @click=${() => {
      this.history.push(this.cursor), this.history.length > 200 && this.history.shift(), this.page++, this.loadList(this.nextCursor);
    }}
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </section> `;
  }
  renderJournalDialogs() {
    const e = this.pending && !this.saving ? a`<p class="warning">
              The result is unconfirmed. Retry the same change before making
              another change.
            </p>
            <div class="actions">
              <button @click=${this.commit}>Retry same change</button
              ><button @click=${this.inspectJournal}>
                Discard retry & inspect journal
              </button>
            </div>` : l;
    return a`<dialog
        id="journal-editor"
        data-admin-dialog
        class="database-dialog journal-dialog"
        aria-labelledby="journal-editor-title"
        @click=${q}
        @cancel=${this.cancelEdit}
      >
        <div class="card-head">
          <h2 id="journal-editor-title">
            ${this.manual ? "New viewing" : "Edit viewing"}
          </h2>
          ${S((t) => this.cancelEdit(t))}
        </div>
        ${this.notice ? a`<p class="notice" role="status">${this.notice}</p>` : l}
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.lastError === "conflict" && this.selected ? a`<button @click=${this.reloadSelected}>Reload entry</button>` : l}
        ${this.draft ? e : l}${this.draft ? this.renderEditor() : l}
      </dialog>
      <dialog
        id="journal-delete"
        data-admin-dialog
        class="database-dialog"
        aria-labelledby="journal-delete-title"
        @click=${q}
        @cancel=${this.cancelDelete}
      >
        <div class="card-head">
          <h2 id="journal-delete-title">Remove this entry from the journal?</h2>
          ${S((t) => this.cancelDelete(t))}
        </div>
        <p>${this.selected?.title}</p>
        <p>
          Stored history and backup copies are retained. This does not
          permanently erase the data.
        </p>
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}${this.confirmDelete ? e : l}
        <div class="dialog-footer">
          <button
            class="danger"
            ?disabled=${this.saving || !!this.pending || !this.confirmDelete}
            @click=${this.deleteRecord}
          >
            Confirm deletion
          </button>
        </div>
      </dialog>`;
  }
  render() {
    if (this.hass?.user && !this.hass.user.is_admin || this.info && !this.info.permissions.edit)
      return a`<kaleidescape-reader
        .hass=${this.hass}
        .client=${this.hass ? void 0 : this.client}
        .narrow=${this.narrow}
      ></kaleidescape-reader>`;
    if (this.info?.permissions.edit && !this.modeReady)
      return a`<main>
        <p role="status">${this.error || "Loading view preference…"}</p>
        ${this.error ? a`<button @click=${() => this.refresh()}>Retry</button>` : l}
      </main>`;
    if (this.info?.permissions.edit && !this.advancedView)
      return a`<kaleidescape-reader
        .hass=${this.hass}
        .client=${this.hass ? void 0 : this.client}
        .narrow=${this.narrow}
        @page-changed=${(t) => {
        ["library", "journal", "now-playing"].includes(t.detail) && (this.activePage = t.detail);
      }}
        @control-lock=${(t) => {
        this.controlLocked = t.detail, this.requestUpdate();
      }}
        >${this.modeControl(this.controlLocked)}</kaleidescape-reader
      >`;
    const e = this.loading || this.saving || !!this.pending || this.maintenanceBusy || this.settingsBusy || this.controlLocked;
    return a`<main>
      <header>
        ${this.hass && this.narrow ? a`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : l}
        <img
          class="companion-icon"
          src=${zs}
          alt=""
          aria-hidden="true"
        />
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Kaleidescape Companion</h1>
          <p>
            ${Lt.find((t) => t.id === this.activePage).description}
          </p>
        </div>
      </header>
      ${this.info?.permissions.edit ? a`<div class="page-navigation">
              <div
                class="page-tabs"
                role="tablist"
                aria-label="Companion pages"
                @keydown=${(t) => this.pageKey(t)}
              >
                ${Lt.map((t) => a`<button id=${`page-${t.id}`} role="tab" aria-selected=${this.activePage === t.id} aria-controls="companion-page" tabindex=${this.activePage === t.id ? "0" : "-1"} ?disabled=${e || t.id === "library" && !this.info?.library_enabled} title=${t.id === "library" && !this.info?.library_enabled ? "Enable library sync in Settings" : l} @click=${() => this.switchPage(t.id)}>${t.label}</button>`)}
              </div>
              ${this.modeControl(e || this.controlLocked)}
            </div>` : l}
      ${this.error ? a`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? a` <button ?disabled=${e} @click=${this.reloadSelected}>Reload entry</button>` : l}</div>` : l}
      ${this.notice ? a`<div class="notice" role="status">${this.notice}</div>` : l}
      ${this.api ? this.info ? a`<section
                id="companion-page"
                @edit-journal=${(t) => {
      const i = t.composedPath()[0];
      i instanceof HTMLElement && this.editLinkedViewing(t.detail, i);
    }}
                @control-lock=${(t) => {
      this.controlLocked = t.detail, this.requestUpdate();
    }}
                @playback-started=${(t) => {
      this.playbackPlayer = t.detail, this.switchPage("now-playing");
    }}
                role="tabpanel"
                aria-labelledby=${`page-${this.activePage}`}
              >
                ${this.activePage === "library" ? a`<kaleidescape-library
                        .client=${this.api}
                        .scope=${this.info}
                        .advanced=${!0}
                        .openTitleId=${this.libraryTitleId}
                        .openCriterion=${this.libraryCriterion}
                        @access-denied=${() => this.fail(new v("unauthorized"))}
                        @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
                      ></kaleidescape-library>` : this.activePage === "database" ? a`<kaleidescape-database
                          .client=${this.api}
                          .scope=${this.info}
                          @access-denied=${() => this.fail(new v("unauthorized"))}
                          @maintenance-busy=${(t) => {
      this.maintenanceBusy !== t.detail && (this.maintenanceBusy = t.detail, this.requestUpdate());
    }}
                          @database-changed=${() => this.refreshInfo()}
                        ></kaleidescape-database>` : this.activePage === "settings" ? a`<kaleidescape-settings
                            .client=${this.api}
                            .scope=${this.info}
                            @access-denied=${() => this.fail(new v("unauthorized"))}
                            @settings-busy=${(t) => {
      this.settingsBusy !== t.detail && (this.settingsBusy = t.detail, this.requestUpdate());
    }}
                            @settings-saved=${() => {
      this.activePage = "settings", H("settings"), this.notice = "Settings saved. Reloading the integration…";
      const t = this.api;
      this.refresh(!0).then(() => {
        this.api === t && this.info && (this.notice = "Settings saved.", this.requestUpdate());
      });
    }}
                          ></kaleidescape-settings>` : this.activePage === "now-playing" ? a`<kaleidescape-now-playing
                              .playerId=${this.playbackPlayer}
                              .client=${this.api}
                              .scope=${this.info}
                            ></kaleidescape-now-playing>` : this.renderJournal()}
              </section>` : a`<div class="empty" role="status">
                <strong
                  >${this.loading ? "Connecting to the journal…" : "Journal unavailable"}</strong
                >${this.loading ? l : a`<button @click=${() => this.refresh()}>Reload connection</button>`}
              </div>` : a`<div class="empty">
              <strong>Connect through Home Assistant</strong>
              <p>
                Open Kaleidescape Companion in HA with an administrator account,
                or connect the local development preview.
              </p>
            </div>`}
      ${this.info ? this.renderJournalDialogs() : l}
    </main>`;
  }
};
mt.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, mt.styles = [E, Li, ys];
let fi = mt;
customElements.get("kaleidescape-panel") || customElements.define("kaleidescape-panel", fi);
export {
  fi as KaleidescapePanel
};
