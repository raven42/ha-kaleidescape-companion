const j = globalThis, lt = j.ShadowRoot && (j.ShadyCSS === void 0 || j.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ht = /* @__PURE__ */ Symbol(), pt = /* @__PURE__ */ new WeakMap();
let Et = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== ht) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (lt && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = pt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && pt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const jt = (n) => new Et(typeof n == "string" ? n : n + "", void 0, ht), O = (n, ...t) => {
  const e = n.length === 1 ? n[0] : t.reduce((i, s, a) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[a + 1], n[0]);
  return new Et(e, n, ht);
}, Mt = (n, t) => {
  if (lt) n.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = j.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, n.appendChild(i);
  }
}, gt = lt ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return jt(e);
})(n) : n;
const { is: It, defineProperty: Bt, getOwnPropertyDescriptor: Ht, getOwnPropertyNames: Wt, getOwnPropertySymbols: Ft, getPrototypeOf: Vt } = Object, G = globalThis, ft = G.trustedTypes, Jt = ft ? ft.emptyScript : "", Gt = G.reactiveElementPolyfillSupport, R = (n, t) => n, tt = { toAttribute(n, t) {
  switch (t) {
    case Boolean:
      n = n ? Jt : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, t) {
  let e = n;
  switch (t) {
    case Boolean:
      e = n !== null;
      break;
    case Number:
      e = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(n);
      } catch {
        e = null;
      }
  }
  return e;
} }, Ut = (n, t) => !It(n, t), bt = { attribute: !0, type: String, converter: tt, reflect: !1, useDefault: !1, hasChanged: Ut };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), G.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let q = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = bt) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = /* @__PURE__ */ Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && Bt(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: a } = Ht(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: s, set(o) {
      const h = s?.call(this);
      a?.call(this, o), this.requestUpdate(t, h, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? bt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(R("elementProperties"))) return;
    const t = Vt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(R("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(R("properties"))) {
      const e = this.properties, i = [...Wt(e), ...Ft(e)];
      for (const s of i) this.createProperty(s, e[s]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, s] of e) this.elementProperties.set(i, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const s = this._$Eu(e, i);
      s !== void 0 && this._$Eh.set(s, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const s of i) e.unshift(gt(s));
    } else t !== void 0 && e.push(gt(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Mt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    const i = this.constructor.elementProperties.get(t), s = this.constructor._$Eu(t, i);
    if (s !== void 0 && i.reflect === !0) {
      const a = (i.converter?.toAttribute !== void 0 ? i.converter : tt).toAttribute(e, i.type);
      this._$Em = t, a == null ? this.removeAttribute(s) : this.setAttribute(s, a), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const a = i.getPropertyOptions(s), o = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : tt;
      this._$Em = s;
      const h = o.fromAttribute(e, a.type);
      this[s] = h ?? this._$Ej?.get(s) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, a) {
    if (t !== void 0) {
      const o = this.constructor;
      if (s === !1 && (a = this[t]), i ??= o.getPropertyOptions(t), !((i.hasChanged ?? Ut)(a, e) || i.useDefault && i.reflect && a === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: a }, o) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), a !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
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
        const { wrapped: o } = a, h = this[s];
        o !== !0 || this._$AL.has(s) || h === void 0 || this.C(s, void 0, a, h);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(e)) : this._$EM();
    } catch (i) {
      throw t = !1, this._$EM(), i;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
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
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
q.elementStyles = [], q.shadowRootOptions = { mode: "open" }, q[R("elementProperties")] = /* @__PURE__ */ new Map(), q[R("finalized")] = /* @__PURE__ */ new Map(), Gt?.({ ReactiveElement: q }), (G.reactiveElementVersions ??= []).push("2.1.2");
const dt = globalThis, mt = (n) => n, M = dt.trustedTypes, yt = M ? M.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, Rt = "$lit$", w = `lit$${Math.random().toFixed(9).slice(2)}$`, Pt = "?" + w, Kt = `<${Pt}>`, k = document, T = () => k.createComment(""), D = (n) => n === null || typeof n != "object" && typeof n != "function", ct = Array.isArray, Yt = (n) => ct(n) || typeof n?.[Symbol.iterator] == "function", Y = `[ 	
\f\r]`, U = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, vt = /-->/g, $t = />/g, _ = RegExp(`>|${Y}(?:([^\\s"'>=/]+)(${Y}*=${Y}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), wt = /'/g, _t = /"/g, Tt = /^(?:script|style|textarea|title)$/i, Qt = (n) => (t, ...e) => ({ _$litType$: n, strings: t, values: e }), r = Qt(1), A = /* @__PURE__ */ Symbol.for("lit-noChange"), l = /* @__PURE__ */ Symbol.for("lit-nothing"), xt = /* @__PURE__ */ new WeakMap(), x = k.createTreeWalker(k, 129);
function Dt(n, t) {
  if (!ct(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return yt !== void 0 ? yt.createHTML(t) : t;
}
const Xt = (n, t) => {
  const e = n.length - 1, i = [];
  let s, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = U;
  for (let h = 0; h < e; h++) {
    const d = n[h];
    let c, f, u = -1, v = 0;
    for (; v < d.length && (o.lastIndex = v, f = o.exec(d), f !== null); ) v = o.lastIndex, o === U ? f[1] === "!--" ? o = vt : f[1] !== void 0 ? o = $t : f[2] !== void 0 ? (Tt.test(f[2]) && (s = RegExp("</" + f[2], "g")), o = _) : f[3] !== void 0 && (o = _) : o === _ ? f[0] === ">" ? (o = s ?? U, u = -1) : f[1] === void 0 ? u = -2 : (u = o.lastIndex - f[2].length, c = f[1], o = f[3] === void 0 ? _ : f[3] === '"' ? _t : wt) : o === _t || o === wt ? o = _ : o === vt || o === $t ? o = U : (o = _, s = void 0);
    const $ = o === _ && n[h + 1].startsWith("/>") ? " " : "";
    a += o === U ? d + Kt : u >= 0 ? (i.push(c), d.slice(0, u) + Rt + d.slice(u) + w + $) : d + w + (u === -2 ? h : $);
  }
  return [Dt(n, a + (n[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class L {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let a = 0, o = 0;
    const h = t.length - 1, d = this.parts, [c, f] = Xt(t, e);
    if (this.el = L.createElement(c, i), x.currentNode = this.el.content, e === 2 || e === 3) {
      const u = this.el.content.firstChild;
      u.replaceWith(...u.childNodes);
    }
    for (; (s = x.nextNode()) !== null && d.length < h; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const u of s.getAttributeNames()) if (u.endsWith(Rt)) {
          const v = f[o++], $ = s.getAttribute(u).split(w), z = /([.?@])?(.*)/.exec(v);
          d.push({ type: 1, index: a, name: z[2], strings: $, ctor: z[1] === "." ? te : z[1] === "?" ? ee : z[1] === "@" ? ie : K }), s.removeAttribute(u);
        } else u.startsWith(w) && (d.push({ type: 6, index: a }), s.removeAttribute(u));
        if (Tt.test(s.tagName)) {
          const u = s.textContent.split(w), v = u.length - 1;
          if (v > 0) {
            s.textContent = M ? M.emptyScript : "";
            for (let $ = 0; $ < v; $++) s.append(u[$], T()), x.nextNode(), d.push({ type: 2, index: ++a });
            s.append(u[v], T());
          }
        }
      } else if (s.nodeType === 8) if (s.data === Pt) d.push({ type: 2, index: a });
      else {
        let u = -1;
        for (; (u = s.data.indexOf(w, u + 1)) !== -1; ) d.push({ type: 7, index: a }), u += w.length - 1;
      }
      a++;
    }
  }
  static createElement(t, e) {
    const i = k.createElement("template");
    return i.innerHTML = t, i;
  }
}
function E(n, t, e = n, i) {
  if (t === A) return t;
  let s = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const a = D(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== a && (s?._$AO?.(!1), a === void 0 ? s = void 0 : (s = new a(n), s._$AT(n, e, i)), i !== void 0 ? (e._$Co ??= [])[i] = s : e._$Cl = s), s !== void 0 && (t = E(n, s._$AS(n, t.values), s, i)), t;
}
class Zt {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, s = (t?.creationScope ?? k).importNode(e, !0);
    x.currentNode = s;
    let a = x.nextNode(), o = 0, h = 0, d = i[0];
    for (; d !== void 0; ) {
      if (o === d.index) {
        let c;
        d.type === 2 ? c = new N(a, a.nextSibling, this, t) : d.type === 1 ? c = new d.ctor(a, d.name, d.strings, this, t) : d.type === 6 && (c = new se(a, this, t)), this._$AV.push(c), d = i[++h];
      }
      o !== d?.index && (a = x.nextNode(), o++);
    }
    return x.currentNode = k, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class N {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, s) {
    this.type = 2, this._$AH = l, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && t?.nodeType === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = E(this, t, e), D(t) ? t === l || t == null || t === "" ? (this._$AH !== l && this._$AR(), this._$AH = l) : t !== this._$AH && t !== A && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Yt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== l && D(this._$AH) ? this._$AA.nextSibling.data = t : this.T(k.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = L.createElement(Dt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const a = new Zt(s, this), o = a.u(this.options);
      a.p(e), this.T(o), this._$AH = a;
    }
  }
  _$AC(t) {
    let e = xt.get(t.strings);
    return e === void 0 && xt.set(t.strings, e = new L(t)), e;
  }
  k(t) {
    ct(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const a of t) s === e.length ? e.push(i = new N(this.O(T()), this.O(T()), this, this.options)) : i = e[s], i._$AI(a), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = mt(t).nextSibling;
      mt(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class K {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, a) {
    this.type = 1, this._$AH = l, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = l;
  }
  _$AI(t, e = this, i, s) {
    const a = this.strings;
    let o = !1;
    if (a === void 0) t = E(this, t, e, 0), o = !D(t) || t !== this._$AH && t !== A, o && (this._$AH = t);
    else {
      const h = t;
      let d, c;
      for (t = a[0], d = 0; d < a.length - 1; d++) c = E(this, h[i + d], e, d), c === A && (c = this._$AH[d]), o ||= !D(c) || c !== this._$AH[d], c === l ? t = l : t !== l && (t += (c ?? "") + a[d + 1]), this._$AH[d] = c;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === l ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class te extends K {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === l ? void 0 : t;
  }
}
class ee extends K {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== l);
  }
}
class ie extends K {
  constructor(t, e, i, s, a) {
    super(t, e, i, s, a), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = E(this, t, e, 0) ?? l) === A) return;
    const i = this._$AH, s = t === l && i !== l || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, a = t !== l && (i === l || s);
    s && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class se {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    E(this, t);
  }
}
const ae = dt.litHtmlPolyfillSupport;
ae?.(L, N), (dt.litHtmlVersions ??= []).push("3.3.3");
const ne = (n, t, e) => {
  const i = e?.renderBefore ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const a = e?.renderBefore ?? null;
    i._$litPart$ = s = new N(t.insertBefore(T(), a), a, void 0, e ?? {});
  }
  return s._$AI(n), s;
};
const ut = globalThis;
class y extends q {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = ne(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return A;
  }
}
y._$litElement$ = !0, y.finalized = !0, ut.litElementHydrateSupport?.({ LitElement: y });
const re = ut.litElementPolyfillSupport;
re?.({ LitElement: y });
(ut.litElementVersions ??= []).push("4.2.2");
class p extends Error {
  constructor(t) {
    super(t), this.code = t;
  }
}
const b = "kaleidescape_companion", oe = 15e3, m = ({ entry_id: n, dataset_id: t }) => ({
  entry_id: n,
  dataset_id: t
}), le = 256 * 1024 * 1024, kt = 5 * 1024 * 1024, he = 32 * 1024 * 1024;
function de() {
  const n = globalThis.crypto;
  if (typeof n?.randomUUID == "function") return n.randomUUID();
  if (typeof n?.getRandomValues != "function")
    throw new p("request_id_unavailable");
  const t = n.getRandomValues(new Uint8Array(16));
  t[6] = t[6] & 15 | 64, t[8] = t[8] & 63 | 128;
  const e = Array.from(
    t,
    (i) => i.toString(16).padStart(2, "0")
  ).join("");
  return `${e.slice(0, 8)}-${e.slice(8, 12)}-${e.slice(12, 16)}-${e.slice(16, 20)}-${e.slice(20)}`;
}
async function Q(n, t, e) {
  const i = n.body?.getReader();
  if (!i) throw new p("storage_error");
  const s = [];
  let a = 0;
  try {
    for (; ; ) {
      const { value: o, done: h } = await i.read();
      if (h) break;
      if (a += o.byteLength, a > t) throw new p("export_too_large");
      s.push(new Uint8Array(o));
    }
    return new Blob(s, { type: e });
  } finally {
    await i.cancel().catch(() => {
    }), i.releaseLock();
  }
}
function g(n) {
  return typeof n == "object" && n !== null && "code" in n && typeof n.code == "string" ? n.code : "connection_lost";
}
function S(n) {
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
    library_too_large: "A library response exceeded its safety limit. Cached data is retained.",
    library_artwork: "Some artwork could not be cached. Previous artwork is retained when available."
  }[g(n)] ?? "The connection was interrupted. The result could not be confirmed.";
}
async function ce(n) {
  let t;
  try {
    return await Promise.race([
      n,
      new Promise((e, i) => {
        t = setTimeout(
          () => i(new p("connection_lost")),
          oe
        );
      })
    ]);
  } finally {
    clearTimeout(t);
  }
}
class Lt {
  constructor(t) {
    this.transport = t;
  }
  call(t) {
    return ce(this.transport.callWS(t));
  }
  info() {
    return this.call({ type: `${b}/info` });
  }
  list(t, e = "", i = "", s) {
    return this.call({
      type: `${b}/journal/list`,
      ...m(t),
      query: e,
      limit: 25,
      ...i ? { status: i } : {},
      ...s ? { cursor: s } : {}
    });
  }
  get(t, e) {
    return this.call({
      type: `${b}/journal/get`,
      ...m(t),
      viewing_id: e
    });
  }
  sessions(t, e) {
    return this.call({
      type: `${b}/journal/sessions`,
      ...m(t),
      viewing_id: e
    });
  }
  nowPlaying(t) {
    return this.call({ type: `${b}/now_playing`, ...m(t) });
  }
  libraryInfo(t) {
    return this.call({ type: `${b}/library/info`, ...m(t) });
  }
  libraryList(t, e = {}) {
    return this.call({
      type: `${b}/library/list`,
      ...m(t),
      filters: e
    });
  }
  librarySync(t) {
    return this.call({ type: `${b}/library/sync`, ...m(t) });
  }
  async libraryArtwork(t, e, i) {
    if (!/^[a-f0-9]{64}$/.test(e)) throw new p("invalid_request");
    const s = await this.transport.fetchWithAuth(
      `/api/${b}/${encodeURIComponent(t.entry_id)}/${encodeURIComponent(t.dataset_id)}/library/artwork/${e}`,
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
    return Q(s, kt, a);
  }
  settings(t, e, i = {}) {
    return this.call({
      ...i,
      ...m(t),
      type: `${b}/settings/${e}`
    });
  }
  inspect(t, e, i = 0, s) {
    return this.call({
      type: `${b}/database/inspect`,
      ...m(t),
      table: e,
      offset: i,
      ...s == null ? {} : { revision: s }
    });
  }
  preparePurge(t, e) {
    return this.prepareCommand(t, "database/purge", e);
  }
  prepareDatabaseUpdate(t, e) {
    return this.prepareCommand(t, "database/update", e);
  }
  prepareImport(t, e, i) {
    const s = /\.(sqlite|sqlite3|db)$/i.test(e.name) ? "sqlite" : /\.json$/i.test(e.name) ? "json" : null;
    if (!s) throw new p("invalid_request");
    if (!e.size || e.size > he)
      throw new p("import_too_large");
    return this.prepareCommand(t, "database/import", { format: s, revision: i });
  }
  async importFile(t, e, i) {
    const { scope: s, message: a } = t, o = new URLSearchParams({
      format: String(a.format),
      request_id: String(a.request_id),
      revision: String(a.revision)
    }), h = await this.transport.fetchWithAuth(
      `/api/${b}/${encodeURIComponent(s.entry_id)}/${encodeURIComponent(s.dataset_id)}/import?${o}`,
      {
        method: "POST",
        body: e,
        signal: i,
        redirect: "error",
        headers: { "Content-Type": "application/octet-stream" }
      }
    );
    if (!h.ok) {
      const d = {
        401: "unauthorized",
        403: "unauthorized",
        413: "import_too_large",
        404: "not_found"
      };
      if (d[h.status]) throw new p(d[h.status]);
      const c = await h.json().catch(() => null);
      throw new p(c?.code ?? "connection_lost");
    }
    return h.json();
  }
  purge(t) {
    return this.call({ ...t.message });
  }
  async artwork(t, e) {
    if (!/^media_player\.[a-z0-9_]{1,255}$/.test(t))
      throw new p("invalid_request");
    const i = await this.transport.fetchWithAuth(
      `/api/media_player_proxy/${t}`,
      {
        signal: e,
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
    return !s || !["image/jpeg", "image/png", "image/webp"].includes(s) ? (await i.body?.cancel(), null) : Q(i, kt, s);
  }
  prepare(t, e, i) {
    return this.prepareCommand(t, `journal/${e}`, i);
  }
  prepareCommand(t, e, i) {
    const s = structuredClone({
      ...i,
      ...m(t),
      type: `${b}/${e}`,
      request_id: de()
    });
    return { scope: m(t), message: Object.freeze(s) };
  }
  mutate(t) {
    return this.call({ ...t.message });
  }
  async download(t, e, i) {
    const s = `/api/${b}/${encodeURIComponent(t.entry_id)}/${encodeURIComponent(t.dataset_id)}/export?format=${e}`, a = await this.transport.fetchWithAuth(s, {
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
    return Q(
      a,
      le,
      e === "json" ? "application/json" : "application/vnd.sqlite3"
    );
  }
}
function St(n) {
  const t = new Date(n);
  return new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
}
function P(n) {
  return {
    title: n?.title ?? "",
    started_at: St(n?.started_at ?? (/* @__PURE__ */ new Date()).toISOString()),
    ended_at: n?.ended_at ? St(n.ended_at) : "",
    duration_seconds: n?.duration_seconds == null ? "" : (n.duration_seconds / 60).toFixed(2),
    watched_seconds: ((n?.watched_seconds ?? 0) / 60).toFixed(2),
    status: n?.status ?? "partial",
    notes: n?.notes ?? "",
    source_id: n?.source_id ?? "",
    player_id: n?.player_id ?? "",
    raw_content_id: n?.raw_content_id ?? ""
  };
}
function Ot(n, t) {
  const e = {};
  for (const [i, s] of Object.entries(n))
    t && s === t[i] || (i === "started_at" || i === "ended_at" ? e[i] = s ? new Date(s).toISOString() : null : i === "duration_seconds" || i === "watched_seconds" ? e[i] = s === "" ? null : Number(s) * 60 : ["source_id", "player_id", "raw_content_id"].includes(i) ? e[i] = s === "" ? null : s : e[i] = s);
  return e;
}
function Nt(n, t) {
  function e(i, s, a = "text", o = !1, h) {
    return r`<label
      >${s}<input
        id=${i === "title" ? "title" : i}
        name=${i}
        type=${a}
        .value=${n[i]}
        ?required=${o}
        maxlength=${h ?? l}
        min=${a === "number" ? "0" : l}
        max=${a === "number" ? String(1e9 / 60) : l}
        step=${a === "datetime-local" ? "1" : a === "number" ? "0.01" : l}
        @input=${(d) => t(i, d)}
    /></label>`;
  }
  return r`
    <div class="grid">
      <div class="full">${e("title", "Title", "text", !0, 500)}</div>
      ${e("started_at", "Started · local time", "datetime-local", !0)}
      ${e("ended_at", "Ended · local time", "datetime-local")}
      ${e("watched_seconds", "Watched minutes", "number", !0)}
      ${e("duration_seconds", "Runtime minutes · optional", "number")}
      <label
        >Status<select
          name="record_status"
          .value=${n.status}
          @change=${(i) => t("status", i)}
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
          @input=${(i) => t("notes", i)}
        ></textarea>
      </label>
    </div>
    <details>
      <summary>Source identifiers</summary>
      <div class="grid">
        ${e("source_id", "Source ID", "text", !1, 255)}
        ${e("player_id", "Player ID", "text", !1, 255)}
        <div class="full">
          ${e("raw_content_id", "Raw content ID", "text", !1, 255)}
        </div>
      </div>
      <small
        >Keep source identifiers exact. Titles do not establish movie
        identity.</small
      >
    </details>
  `;
}
const C = O`
  :host {
    display: block;
    min-height: 100dvh;
    color: var(--primary-text-color, #20302c);
    background: var(--primary-background-color, #f5f7f6);
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    --accent: var(--primary-color, #256b59);
    --line: var(--divider-color, #dbe3df);
    --surface: var(--card-background-color, #fff);
    --muted: var(--secondary-text-color, #52645d);
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
  .database-entries {
    padding: 20px;
  }
  .database {
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
  .library-page {
    margin-top: 24px;
  }
  .library-filters {
    padding: 20px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
    gap: 14px;
    align-items: end;
  }
  .library-title {
    margin-top: 20px;
    padding-top: 20px;
  }
  .library-note {
    padding: 0 20px;
  }
  .library-title h2,
  .library-title p {
    overflow-wrap: anywhere;
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
`, I = class I extends y {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.userKey = "", this.generation = 0, this.scope = null, this.rows = [], this.loading = !1, this.error = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.next = null, this.history = [], this.page = 1;
  }
  willUpdate(t) {
    if (!(!t.has("hass") && !t.has("client")))
      if (this.hass) {
        const e = `${this.hass.user?.id}:${this.hass.user?.is_admin}`;
        !this.hass.user || !this.hass.connection.connected ? this.bind(null) : (this.connection !== this.hass.connection || this.userKey !== e || !this.api) && (this.connection = this.hass.connection, this.userKey = e, this.bind(
          new Lt({
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
    this.generation++, this.scope = null, this.rows = [], this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.query = this.status = this.searchText = this.filterStatus = "", this.loading = !1, this.error = "";
  }
  bind(t) {
    t !== this.api && (this.clear(), this.api = t, this.requestUpdate(), t && this.refresh());
  }
  fail(t) {
    g(t) === "unauthorized" && this.clear(), this.error = S(t), this.requestUpdate();
  }
  async refresh() {
    if (!this.api) return;
    const t = ++this.generation;
    this.scope = null, this.rows = [], this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const { entries: e } = await this.api.info();
      if (t !== this.generation) return;
      if (!e[0]?.permissions.read || e[0].api_version !== 1)
        throw new p("not_ready");
      this.scope = e[0], await this.load(void 0, t);
    } catch (e) {
      t === this.generation && this.fail(e);
    } finally {
      t === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async load(t, e = ++this.generation) {
    if (!(!this.api || !this.scope)) {
      this.loading = !0, this.error = "", this.rows = [], this.requestUpdate();
      try {
        const i = await this.api.list(
          this.scope,
          this.query,
          this.status,
          t
        );
        if (e !== this.generation) return;
        this.rows = i.items, this.next = i.next_cursor, this.cursor = t;
      } catch (i) {
        e === this.generation && (this.next = null, this.fail(i));
      } finally {
        e === this.generation && (this.loading = !1, this.requestUpdate());
      }
    }
  }
  date(t) {
    if (!t) return "—";
    const e = new Date(t);
    return Number.isNaN(e.getTime()) ? "—" : e.toLocaleString();
  }
  render() {
    return r`<main>
      <header>
        ${this.hass && this.narrow ? r`<button aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : l}
        <div>
          <span class="eyebrow">Kaleidescape Companion</span>
          <h1>Viewing history</h1>
          <p>Read-only household journal</p>
        </div>
      </header>
      ${this.error ? r`<p role="alert" class="error">${this.error}</p>` : l}
      <section class="card" aria-label="Viewing history">
        <div class="card-head">
          <h2>Viewings</h2>
          <button ?disabled=${this.loading || !this.api} @click=${this.refresh}>
            Refresh
          </button>
        </div>
        <form
          class="filters"
          @submit=${(t) => {
      t.preventDefault(), this.query = this.searchText, this.status = this.filterStatus, this.history = [], this.page = 1, this.load();
    }}
        >
          <label
            >Search titles<input
              name="search"
              type="search"
              maxlength="500"
              .value=${this.searchText}
              ?disabled=${this.loading || !this.scope}
              @input=${(t) => {
      this.searchText = t.target.value;
    }}
          /></label>
          <label
            >Status<select
              name="filter_status"
              .value=${this.filterStatus}
              ?disabled=${this.loading || !this.scope}
              @change=${(t) => {
      this.filterStatus = t.target.value;
    }}
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
            </select></label
          >
          <button ?disabled=${this.loading || !this.scope}>Search</button>
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
      (t) => r`<tr>
                              <td>
                                <strong>${t.title}</strong
                                ><small
                                  >Started ${this.date(t.started_at)}<br />Ended
                                  ${this.date(t.ended_at)}</small
                                >
                              </td>
                              <td>
                                ${t.status === "completed" ? "Completed" : "Partial"}
                              </td>
                              <td>
                                ${(t.watched_seconds / 60).toFixed(2)} min
                              </td>
                              <td>
                                ${t.duration_seconds == null ? "—" : `${(t.duration_seconds / 60).toFixed(2)} min`}
                              </td>
                            </tr>`
    )}
                      </tbody>
                    </table>
                  </div>` : r`<p>No viewings to display.</p>` : r`<p>
                  Sign in to Home Assistant to view the household journal.
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
      </section>
    </main>`;
  }
};
I.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, I.styles = C;
let et = I;
customElements.get("kaleidescape-reader") || customElements.define("kaleidescape-reader", et);
const ue = {
  playing: "Playing",
  paused: "Paused",
  forward: "Scanning forward",
  reverse: "Scanning backward",
  stopped: "Stopped",
  none: "Stopped"
}, pe = {
  content: "Main content",
  credits: "Credits",
  intermission: "Intermission",
  disc_menu: "Disc menu",
  none: "No active content"
}, B = class B extends y {
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
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = this.scope?.permissions.edit ? `${this.scope.entry_id}:${this.scope.dataset_id}` : "";
    this.boundClient !== this.client || this.boundScope !== e ? (this.reset(), this.boundClient = this.client, this.boundScope = e, this.refresh()) : t.has("client") && !this.timer && !this.loading && this.refresh();
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
    const t = this.client, e = this.scope, i = ++this.generation;
    this.loading = !0, this.denied = !1, this.error = "", this.requestUpdate();
    try {
      const { players: s } = await t.nowPlaying(e);
      if (i !== this.generation) return;
      this.player = s[0] ?? null;
      const a = this.player, o = a?.available && a.artwork_key && a.entity_id ? `${a.entity_id}:${a.raw_content_id}:${a.artwork_key}` : "";
      if (o !== this.imageKey && (this.clearImage(), this.imageKey = o, this.requestUpdate(), o)) {
        const h = this.abort = new AbortController(), d = setTimeout(() => h.abort(), 5e3);
        try {
          const c = await t.artwork(
            a.entity_id,
            h.signal
          );
          i === this.generation && c && (this.image = URL.createObjectURL(c));
        } catch (c) {
          if (g(c) === "unauthorized") throw c;
        } finally {
          clearTimeout(d), this.abort === h && (this.abort = void 0);
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
  recordingStatus(t, e) {
    return t.recording_error ? "Recording needs attention. Check HA diagnostics." : t.recording_paused ? "Recording paused for backup." : t.available ? e && t.recording_exclusion === "below_minimum_runtime" ? `Not recording: runtime is below the minimum of ${t.minimum_runtime_minutes} minutes.` : e && t.recording_exclusion === "runtime_unknown" ? "Waiting for a known runtime before recording." : "Recording enabled." : "Recording waiting for source entities.";
  }
  render() {
    const t = this.player, e = t?.available && !["stopped", "none"].includes(t.play_status);
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
      ${this.error ? r`<p class="playback-message" role="alert">${this.error}</p>` : t ? r`<div class="playback-layout">
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
                  <small>${t.name ?? "Configured player"}</small>
                  <h3>
                    ${t.available ? e ? t.title ?? "Unknown title" : "No movie playing" : "Player unavailable"}
                  </h3>
                  ${t.available ? r`<p>${ue[t.play_status] ?? "Unknown playback state"} · ${pe[t.location] ?? "Unknown location"}</p>` : l}
                  ${e && t.duration_seconds != null ? r`<p>Runtime · ${(t.duration_seconds / 60).toFixed(2)} min</p>` : l}
                  ${e && t.session ? r`<p>
                            This session ·
                            ${(t.session.watched_seconds / 60).toFixed(2)}
                            min counted
                          </p>
                          <small
                            >Pauses and scans are excluded.
                            ${t.session.credits_confirmed ? "Credits confirmed; journal completion also requires the configured watch threshold." : "Credits not yet confirmed."}
                            ${t.session.gap_count ? r` ${t.session.gap_count} timing gap(s).` : l}</small
                          >` : l}
                  <p role="status">
                    ${this.recordingStatus(t, !!e)}
                    ${t.buffered_observations ? r` ${t.buffered_observations} update(s) buffered.` : l}
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
B.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, B.styles = [
  C,
  O`
      :host {
        min-height: 0;
      }
    `
];
let it = B;
customElements.get("kaleidescape-now-playing") || customElements.define("kaleidescape-now-playing", it);
const Ct = [
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
], qt = [
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
], zt = [
  ["library_sync_collections", "Sync collections and watched status"],
  ["library_sync_details", "Sync title details and credits"],
  ["library_sync_artwork", "Sync artwork"]
], ge = /* @__PURE__ */ new Set([
  "tracking_enabled",
  "library_enabled",
  ...zt.map(([n]) => n)
]), fe = {
  missing_entities: "Select all three source entities to enable tracking.",
  invalid_entities: "Choose existing media_player and sensor entity IDs.",
  duplicate_entities: "Choose different sensors for play status and media location.",
  invalid_rules: "Check the runtime, completion, and partial-resume values.",
  invalid_library_host: "Enter a hostname or private LAN HTTP(S) origin without a path, credentials, or query.",
  invalid_library_options: "Choose a sync interval of 1–168 hours and an artwork cache limit of 32–4096 MiB."
}, H = class H extends y {
  constructor() {
    super(...arguments), this.generation = 0, this.draft = {}, this.initial = {}, this.loading = !1, this.saving = !1, this.uncertain = !1, this.error = "", this.bound = "";
  }
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    e === this.bound && this.client === this.boundClient || (this.cancelFlow(), this.bound = e, this.boundClient = this.client, this.boundScope = this.scope, this.flow = void 0, this.draft = {}, this.initial = {}, this.uncertain = this.saving = !1, this.client && this.scope && this.start());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.cancelFlow(), this.flow = void 0, this.draft = {}, this.initial = {}, this.bound = "", this.boundClient = void 0;
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  cancelFlow() {
    this.generation++, this.flow?.flow_id && this.boundClient && this.boundScope && this.boundClient.settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id }).catch(() => {
    });
  }
  fail(t) {
    this.error = S(t), g(t) === "unauthorized" && (this.flow = void 0, this.draft = {}, this.initial = {}, this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async start() {
    const t = this.client, e = this.scope, i = ++this.generation;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const s = await t.settings(e, "start");
      if (i !== this.generation) {
        s.flow_id && t.settings(e, "cancel", { flow_id: s.flow_id }).catch(() => {
        });
        return;
      }
      this.flow = s, this.draft = Object.fromEntries(
        (s.fields ?? []).map((a) => [
          a.name,
          ge.has(a.name) ? !!a.default : String(a.default ?? "")
        ])
      ), this.initial = { ...this.draft };
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
  async save(t) {
    if (t.preventDefault(), !this.client || !this.scope || !this.flow?.flow_id || this.saving || this.uncertain || !t.target.reportValidity()) return;
    const e = this.generation;
    this.saving = !0, this.busy(), this.error = "", this.requestUpdate();
    const i = { ...this.draft };
    for (const [s, , a] of Ct)
      a === "number" ? i[s] = Number(i[s]) : i[s] || delete i[s];
    for (const [s, , a] of qt)
      a === "number" && (i[s] = Number(i[s]));
    i.library_host = String(i.library_host ?? "");
    try {
      const s = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data: i
      });
      if (e !== this.generation) return;
      this.flow = s, s.type === "create_entry" ? (this.initial = { ...this.draft }, this.saving = !1, this.busy(), this.dispatchEvent(
        new CustomEvent("settings-saved", { bubbles: !0, composed: !0 })
      )) : s.type === "form" ? this.error = Object.values(s.errors ?? {}).map(
        (a) => fe[a] ?? "Check the settings and try again."
      ).join(" ") : this.error = "The settings flow ended. Reload settings to continue.";
    } catch (s) {
      e === this.generation && (this.fail(s), this.uncertain = ![
        "unauthorized",
        "invalid_request",
        "conflict"
      ].includes(g(s)));
    } finally {
      e === this.generation && (this.saving = !1, this.busy(), this.requestUpdate());
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
        These are the same settings as the integration’s Configure options.
        Saving reloads the integration.
      </p>
      ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : l}
      ${this.uncertain ? r`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : l}
      ${this.loading ? r`<p role="status">Loading settings…</p>` : this.flow?.type === "form" ? r`<form @submit=${this.save}>
                <fieldset ?disabled=${this.saving || this.uncertain}>
                  <label class="check"
                    ><input
                      name="tracking_enabled"
                      type="checkbox"
                      .checked=${!!this.draft.tracking_enabled}
                      @change=${(t) => {
      this.draft = {
        ...this.draft,
        tracking_enabled: t.target.checked
      }, this.requestUpdate();
    }}
                    />Automatically record playback</label
                  >
                  <div class="grid settings-grid">
                    ${Ct.map(
      ([t, e, i, s, a]) => r`<label class=${i === "text" ? "full" : ""}
                          >${e}<input
                            name=${t}
                            type=${i}
                            min=${s || l}
                            max=${a || l}
                            step=${i === "number" ? "1" : l}
                            maxlength=${i === "text" ? "255" : l}
                            ?required=${i === "number" || !!this.draft.tracking_enabled}
                            .value=${String(this.draft[t] ?? "")}
                            @input=${(o) => {
        this.draft = {
          ...this.draft,
          [t]: o.target.value
        };
      }}
                        /></label>`
    )}
                  </div>
                  <p class="muted">
                    Use HA entity IDs for the three sources. The runtime cutoff
                    uses total duration; missing runtime waits for metadata.
                    Completion uses watched time and confirmed credits.
                  </p>
                  <h3>Library sync</h3>
                  <label class="check"
                    ><input
                      name="library_enabled"
                      type="checkbox"
                      .checked=${!!this.draft.library_enabled}
                      @change=${(t) => {
      this.draft = {
        ...this.draft,
        library_enabled: t.target.checked
      }, this.requestUpdate();
    }}
                    />Enable library sync</label
                  >
                  <p class="muted">
                    Optional, read-only access to your local Kaleidescape
                    library. Disabled by default; no library discovery or device
                    requests occur while disabled.
                  </p>
                  ${this.draft.library_enabled ? r`<div class="grid settings-grid">
                            ${qt.map(
      ([t, e, i, s, a]) => r`<label
                                  class=${i === "text" ? "full" : ""}
                                  >${e}<input
                                    name=${t}
                                    type=${i}
                                    min=${s || l}
                                    max=${a || l}
                                    step=${i === "number" ? "1" : l}
                                    maxlength=${i === "text" ? "255" : l}
                                    ?required=${i === "number"}
                                    .value=${String(this.draft[t] ?? "")}
                                    @input=${(o) => {
        this.draft = {
          ...this.draft,
          [t]: o.target.value
        }, this.requestUpdate();
      }}
                                /></label>`
    )}
                            ${zt.map(
      ([t, e]) => r`<label class="check full"
                                  ><input
                                    name=${t}
                                    type="checkbox"
                                    .checked=${!!this.draft[t]}
                                    @change=${(i) => {
        this.draft = {
          ...this.draft,
          [t]: i.target.checked
        }, this.requestUpdate();
      }}
                                  />${e}</label
                                >`
    )}
                          </div>
                          <p class="muted">
                            Played means watched; Paused takes priority as
                            in-progress. Detail fields depend on available
                            source metadata. “Added on” means first detected,
                            not purchased or downloaded.
                          </p>
                          ${this.draft.library_sync_artwork ? r`<p class="warning">Artwork uses additional disk space in a separate private cache, up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. Increase the cache limit for a large library; older covers may be evicted and fetched again. HA backups can include these files.</p>` : l}` : l}
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
              </form>` : l}
    </section>`;
  }
};
H.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, H.styles = C;
let st = H;
customElements.get("kaleidescape-settings") || customElements.define("kaleidescape-settings", st);
const W = class W extends y {
  constructor() {
    super(...arguments), this.disabled = !1, this.bound = "", this.generation = 0, this.working = !1, this.error = "", this.notice = "", this.dialog = null;
  }
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    this.boundClient === this.client && this.bound === e || (this.clear(), this.bound = e, this.boundClient = this.client);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.controller?.abort(), this.controller = void 0, this.file = void 0;
    const t = this.renderRoot.querySelector('input[type="file"]');
    t && (t.value = ""), this.pending = void 0, this.working = !1, this.hideDialog(), this.error = this.notice = "", this.busy();
  }
  async openDialog(t) {
    if (this.disabled || this.working || this.pending || !this.dispatchEvent(
      new CustomEvent("transfer-open", {
        detail: t,
        bubbles: !0,
        composed: !0,
        cancelable: !0
      })
    ))
      return;
    const e = this.generation;
    this.dialog = t, this.error = this.notice = "", this.requestUpdate(), await this.updateComplete, !(e !== this.generation || !this.isConnected) && this.renderRoot.querySelector("dialog")?.showModal();
  }
  hideDialog() {
    this.renderRoot.querySelector("dialog")?.close(), this.dialog = null;
  }
  closeDialog(t) {
    if (t?.preventDefault(), this.working || this.pending) return;
    const e = this.dialog;
    this.hideDialog(), this.file = void 0;
    const i = this.renderRoot.querySelector('input[type="file"]');
    i && (i.value = ""), this.requestUpdate(), this.renderRoot.querySelector(`[data-transfer="${e}"]`)?.focus();
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
  fail(t) {
    g(t) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = S(t), this.requestUpdate();
  }
  async exportData(t) {
    if (!this.client || !this.scope || this.working || this.pending || this.disabled)
      return;
    const e = this.generation, i = this.controller = new AbortController(), s = setTimeout(() => i.abort(), 65e3);
    this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const a = await this.client.download(
        this.scope,
        t,
        i.signal
      );
      if (e !== this.generation) return;
      const o = URL.createObjectURL(a), h = document.createElement("a");
      try {
        h.href = o, h.download = `kaleidescape-journal.${t}`, h.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(o), 1e3);
      }
      this.notice = "Export downloaded. Keep this private copy in a protected location.", this.hideDialog();
    } catch (a) {
      e === this.generation && this.fail(a);
    } finally {
      clearTimeout(s), e === this.generation && (this.working = !1, this.controller = void 0, this.busy(), this.requestUpdate());
    }
  }
  async importData() {
    if (!(!this.client || !this.scope || !this.file || this.working || this.disabled || this.scope.tracking_enabled))
      try {
        this.pending ??= this.client.prepareImport(
          this.scope,
          this.file,
          this.scope.revision
        );
        const t = this.generation, e = this.controller = new AbortController(), i = setTimeout(() => e.abort(), 65e3);
        this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
        try {
          const s = await this.client.importFile(
            this.pending,
            this.file,
            e.signal
          );
          if (t !== this.generation) return;
          this.pending = void 0, this.file = void 0;
          const a = this.renderRoot.querySelector('input[type="file"]');
          a && (a.value = ""), this.notice = `Imported ${s.imported_count} entries; skipped ${s.skipped_count} existing entries.`, this.hideDialog(), this.dispatchEvent(
            new CustomEvent("database-changed", {
              bubbles: !0,
              composed: !0
            })
          );
        } catch (s) {
          if (t !== this.generation) return;
          [
            "invalid_request",
            "unauthorized",
            "conflict",
            "not_found",
            "tracking_enabled",
            "import_too_large"
          ].includes(g(s)) && (this.pending = void 0), this.fail(s);
        } finally {
          clearTimeout(i), t === this.generation && (this.working = !1, this.controller = void 0, this.busy(), this.requestUpdate());
        }
      } catch (t) {
        this.fail(t);
      }
  }
  render() {
    const t = this.disabled || this.working || !!this.pending;
    return r`<div class="actions" aria-label="Import and export">
        <button
          data-transfer="import"
          ?disabled=${t}
          @click=${() => this.openDialog("import")}
        >
          Import
        </button>
        <button
          data-transfer="export"
          ?disabled=${t}
          @click=${() => this.openDialog("export")}
        >
          Export
        </button>
      </div>
      ${!this.dialog && this.error ? r`<p class="error" role="alert">${this.error}</p>` : l}
      ${!this.dialog && this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : l}
      <dialog
        class="database-dialog"
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : "Import viewings"}
          </h2>
        </div>
        ${this.error && this.dialog ? r`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.dialog === "export" ? r`<p>
                  Exports include private history and deleted records. SQLite
                  also includes catalog and source metadata. Store downloads
                  securely.
                </p>
                <div class="actions">
                  <button
                    ?disabled=${t}
                    @click=${() => this.exportData("json")}
                  >
                    Export JSON</button
                  ><button
                    ?disabled=${t}
                    @click=${() => this.exportData("sqlite")}
                  >
                    Export SQLite
                  </button>
                </div>` : this.dialog === "import" ? r`<p>
                    Merge compatible JSON or SQLite exports, including prior
                    versions. Existing IDs stay unchanged. Restores viewing
                    snapshots and deleted status; session evidence, audit
                    records, and retry state stay local. Maximum 32 MiB and
                    10,000 entries.
                  </p>
                  ${this.scope?.tracking_enabled ? r`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : l}
                  <label
                    >JSON or SQLite export<input
                      type="file"
                      accept=".json,.sqlite,.sqlite3,.db"
                      ?disabled=${t || !!this.scope?.tracking_enabled}
                      @change=${(e) => {
      this.file = e.target.files?.[0], this.error = this.notice = "", this.requestUpdate();
    }}
                  /></label>
                  ${this.file ? r`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : l}
                  <div class="actions">
                    <button
                      class="primary"
                      ?disabled=${t || !this.file || !!this.scope?.tracking_enabled}
                      @click=${this.importData}
                    >
                      Import new entries
                    </button>
                  </div>
                  ${this.pending ? r`<div class="warning">
                          ${this.working ? "Importing…" : "The import result is unconfirmed. Retry the same file and request to confirm it."}
                          <div class="actions">
                            <button
                              ?disabled=${this.working}
                              @click=${this.importData}
                            >
                              Retry same import</button
                            ><button
                              ?disabled=${this.working}
                              @click=${() => {
      if (window.confirm(
        "The import may already have committed. Discard its retry and inspect the database before importing again?"
      )) {
        this.pending = void 0, this.file = void 0;
        const e = this.renderRoot.querySelector(
          'input[type="file"]'
        );
        e && (e.value = ""), this.hideDialog(), this.busy(), this.dispatchEvent(
          new CustomEvent("database-changed", {
            bubbles: !0,
            composed: !0
          })
        ), this.requestUpdate();
      }
    }}
                            >
                              Discard import retry & inspect
                            </button>
                          </div>
                        </div>` : l}` : l}
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
W.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, W.styles = [
  C,
  O`
      :host {
        min-height: 0;
        background: transparent;
      }
    `
];
let at = W;
customElements.get("kaleidescape-transfers") || customElements.define("kaleidescape-transfers", at);
const X = {
  viewings: "Viewings",
  sessions: "Sessions",
  requests: "Write requests",
  manual_audit: "Manual audit",
  maintenance_audit: "Maintenance audit",
  import_audit: "Import audit",
  schema_metadata: "Metadata",
  library_sources: "Library sources",
  library_titles: "Library titles",
  library_collections: "Library collections",
  library_memberships: "Library memberships",
  library_artwork: "Library artwork"
}, F = class F extends y {
  constructor() {
    super(...arguments), this.bound = "", this.generation = 0, this.table = "viewings", this.selected = /* @__PURE__ */ new Set(), this.confirming = null, this.confirmation = "", this.purgeOpen = !1, this.transferBusy = !1, this.detail = null, this.draft = null, this.initial = null, this.loading = !1, this.saving = !1, this.error = "", this.notice = "";
  }
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    e === this.bound && this.client === this.boundClient || (this.clear(), this.bound = e, this.boundClient = this.client, this.client && this.scope && this.load());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  clear() {
    this.generation++, this.page = void 0, this.selected.clear(), this.confirming = null, this.hidePurge(), this.confirmation = this.error = this.notice = "", this.pending = this.editPending = void 0, this.detail = this.draft = this.initial = null, this.transferBusy = !1, this.loading = this.saving = !1, this.busy();
  }
  hidePurge() {
    this.renderRoot.querySelector("#purge-dialog")?.close(), this.purgeOpen = !1;
  }
  async openPurge() {
    if (this.blocked || this.table !== "viewings" || this.scope?.tracking_enabled || !this.discard())
      return;
    const t = this.generation;
    this.confirming = null, this.confirmation = "", this.detail = this.draft = this.initial = null, this.purgeOpen = !0, this.requestUpdate(), await this.updateComplete, t === this.generation && this.isConnected && this.renderRoot.querySelector("#purge-dialog")?.showModal();
  }
  closePurge(t) {
    t?.preventDefault(), !(this.saving || this.pending) && (this.hidePurge(), this.confirming = null, this.confirmation = "", this.requestUpdate(), this.renderRoot.querySelector("#purge-entry")?.focus());
  }
  get blocked() {
    return this.loading || this.saving || !!this.pending || !!this.editPending || this.transferBusy;
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("maintenance-busy", {
        detail: !!this.pending || !!this.editPending || this.saving || this.transferBusy,
        bubbles: !0,
        composed: !0
      })
    );
  }
  fail(t) {
    g(t) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = S(t), this.requestUpdate();
  }
  async load(t = 0, e) {
    if (!this.client || !this.scope || this.pending || this.editPending || !this.discard())
      return;
    const i = ++this.generation;
    this.loading = !0, this.error = "", this.selected.clear(), this.confirming = null, this.confirmation = "", this.page = void 0, this.detail = this.draft = this.initial = null, this.requestUpdate();
    try {
      const s = await this.client.inspect(
        this.scope,
        this.table,
        t,
        e
      );
      i === this.generation && (this.page = s);
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async purge(t) {
    if (t?.preventDefault(), !(!this.client || !this.scope || this.saving))
      try {
        if (!this.pending) {
          if (!this.page || !this.confirming || this.scope.tracking_enabled || this.confirming === "selected" && !this.selected.size)
            return;
          const i = this.confirming === "all";
          if (this.confirmation !== (i ? "PURGE ALL" : "PURGE") || !this.discard()) return;
          this.detail = this.draft = this.initial = null, this.pending = this.client.preparePurge(this.scope, {
            viewing_ids: i ? [] : [...this.selected],
            all: i,
            expected_revision: this.page.revision,
            confirmation: this.confirmation
          });
        }
        const e = this.generation;
        this.saving = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
        try {
          const i = await this.client.purge(this.pending);
          if (e !== this.generation) return;
          this.pending = void 0, this.hidePurge(), this.notice = `Permanently purged ${i.purged_count} entries. Backups and exports were not changed.`, this.dispatchEvent(
            new CustomEvent("database-changed", {
              bubbles: !0,
              composed: !0
            })
          ), await this.load();
        } catch (i) {
          if (e !== this.generation) return;
          [
            "unauthorized",
            "invalid_request",
            "conflict",
            "not_found",
            "tracking_enabled"
          ].includes(g(i)) && (this.pending = void 0), this.fail(i);
        } finally {
          (e === this.generation || !this.pending) && (this.saving = !1, this.busy(), this.requestUpdate());
        }
      } catch (e) {
        this.fail(e);
      }
  }
  discardRetry() {
    this.saving || !window.confirm(
      "The purge may already have committed. Discard its retry and refresh the database to inspect the result?"
    ) || (this.pending = void 0, this.hidePurge(), this.busy(), this.load());
  }
  discard() {
    return !this.draft || JSON.stringify(this.draft) === JSON.stringify(this.initial) || window.confirm("Discard your unsaved changes?");
  }
  confirmNavigation() {
    return this.discard();
  }
  showDetail(t) {
    this.discard() && (this.detail = t, this.draft = this.table === "viewings" ? P(t) : null, this.initial = this.draft ? { ...this.draft } : null, this.requestUpdate());
  }
  newEntry() {
    this.table !== "viewings" || this.loading || this.saving || this.pending || this.editPending || this.transferBusy || !this.discard() || (this.detail = null, this.draft = P(), this.initial = { ...this.draft }, this.error = this.notice = "", this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector("#title")?.focus()
    ));
  }
  async saveDetail(t) {
    if (t?.preventDefault(), !(!this.client || !this.scope || !this.draft || !this.initial || this.saving || this.pending || this.transferBusy) && !(t && !t.target.reportValidity()))
      try {
        if (!this.editPending) {
          const e = Ot(
            this.draft,
            this.detail ? this.initial : void 0
          );
          if (!Object.keys(e).length) {
            this.notice = "There are no changes to save.", this.requestUpdate();
            return;
          }
          this.editPending = this.detail ? this.client.prepareDatabaseUpdate(this.scope, {
            viewing_id: this.detail.id,
            expected_revision: this.detail.revision,
            patch: e
          }) : this.client.prepare(this.scope, "create", { data: e });
        }
        await this.mutateDetail();
      } catch (e) {
        this.fail(e);
      }
  }
  async deleteEntry() {
    if (!this.client || !this.scope || this.blocked || this.table !== "viewings" || this.selected.size !== 1)
      return;
    const t = this.page?.items.find(
      (e) => this.selected.has(String(e.id))
    );
    if (!(!t || t.deleted_at || !this.discard() || !window.confirm(
      `Delete “${String(t.title)}” from the journal? Its database record will be retained.`
    )))
      try {
        this.editPending = this.client.prepare(this.scope, "delete", {
          viewing_id: t.id,
          expected_revision: t.revision
        }), this.detail = this.draft = this.initial = null, await this.mutateDetail();
      } catch (e) {
        this.fail(e);
      }
  }
  async mutateDetail() {
    if (!this.client || !this.editPending || this.saving) return;
    const t = this.editPending.message.type.endsWith("/delete"), e = this.generation;
    this.saving = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const i = await this.client.mutate(this.editPending);
      if (e !== this.generation) return;
      this.editPending = void 0, this.detail = this.draft = this.initial = null, this.notice = t ? "Viewing deleted from the journal. Its database record is retained." : "Viewing saved.", this.dispatchEvent(
        new CustomEvent("database-changed", {
          bubbles: !0,
          composed: !0
        })
      );
      const s = this.generation + 1;
      if (await this.load(), this.generation !== s || !this.isConnected || t)
        return;
      const a = this.page?.items.find((o) => o.id === i.viewing.id);
      this.showDetail(
        a ?? i.viewing
      );
    } catch (i) {
      if (e !== this.generation) return;
      ["invalid_request", "conflict", "unauthorized", "not_found"].includes(
        g(i)
      ) && (this.editPending = void 0), this.fail(i);
    } finally {
      (e === this.generation || !this.editPending) && (this.saving = !1, this.busy(), this.requestUpdate());
    }
  }
  renderMutationRetry() {
    return this.editPending ? r`<div class="warning" role="status">
          ${this.saving ? "Saving…" : "The change result is unconfirmed. Retry the exact change."}
          <div class="actions">
            <button
              ?disabled=${this.saving}
              @click=${() => this.mutateDetail()}
            >
              Retry same change
            </button>
            <button
              ?disabled=${this.saving}
              @click=${() => {
      window.confirm(
        "This change may already have committed. Discard its retry and reload the database?"
      ) && (this.editPending = void 0, this.draft = this.initial = null, this.busy(), this.load());
    }}
            >
              Discard retry & reload
            </button>
          </div>
        </div>` : l;
  }
  renderDetail(t) {
    return !this.detail && !this.draft ? r`<div class="empty">
        Select an entry to inspect its details.
      </div>` : r`<div class="card-head">
        <h2>
          ${this.draft ? this.detail ? "Edit viewing" : "New viewing" : "Entry details"}
        </h2>
      </div>
      ${this.draft ? r`<form class="editor" @submit=${this.saveDetail}>
              <fieldset ?disabled=${t}>
                ${Nt(this.draft, (e, i) => {
      this.draft = {
        ...this.draft,
        [e]: i.target.value
      }, this.requestUpdate();
    })}
                <p class="muted">
                  Only changed viewing fields are corrected. Deletion status and
                  recorded session evidence are preserved.
                </p>
                <div class="actions">
                  <button type="submit" class="primary">
                    ${this.detail ? "Save viewing" : "Create entry"}</button
                  ><button
                    type="button"
                    @click=${() => {
      this.discard() && (this.detail = this.draft = this.initial = null, this.requestUpdate());
    }}
                  >
                    Close details
                  </button>
                </div>
              </fieldset>
            </form>` : r`<p class="muted">
              System metadata, evidence, retry, and audit records are read-only.
            </p>`}
      ${this.detail ? r`<h3>Raw stored values</h3>
              <pre>${JSON.stringify(this.detail, null, 2)}</pre>` : l}`;
  }
  switchTable(t) {
    this.blocked || this.discard() && (this.table = t, this.draft = this.initial = null, this.load());
  }
  tabKey(t, e) {
    const i = e.indexOf(this.table), s = t.key === "ArrowRight" ? (i + 1) % e.length : t.key === "ArrowLeft" ? (i + e.length - 1) % e.length : t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : -1;
    s < 0 || (t.preventDefault(), this.switchTable(e[s]), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#table-${this.table}`)?.focus()
    ));
  }
  render() {
    const t = this.blocked, e = Object.keys(this.page?.tables ?? X), i = this.selected.size === 1 ? this.page?.items.find((a) => this.selected.has(String(a.id))) : void 0, s = this.table === "viewings";
    return r`<section class="card database" aria-label="Database management">
      <div class="database-toolbar">
        <div class="actions" aria-label="Entry actions">
          <button
            class="primary"
            ?disabled=${t || !s}
            @click=${this.newEntry}
          >
            New Entry
          </button>
          <button
            class="danger"
            ?disabled=${t || !s || !i || !!i.deleted_at}
            @click=${this.deleteEntry}
          >
            Delete entry
          </button>
          <button
            id="purge-entry"
            class="danger"
            ?disabled=${t || !s || !!this.scope?.tracking_enabled || !this.page?.tables.viewings}
            @click=${this.openPurge}
          >
            Purge entry
          </button>
          <button ?disabled=${t} @click=${() => this.load()}>
            Refresh database
          </button>
        </div>
        <kaleidescape-transfers
          .client=${this.client}
          .scope=${this.scope ? { ...this.scope, revision: this.page?.revision ?? this.scope.revision } : void 0}
          .disabled=${this.loading || this.saving || !!this.pending || !!this.editPending || this.purgeOpen}
          @transfer-open=${(a) => {
      if (a.detail === "import") {
        if (!this.discard()) {
          a.preventDefault();
          return;
        }
        this.detail = this.draft = this.initial = null, this.requestUpdate();
      }
    }}
          @transfer-busy=${(a) => {
      this.transferBusy = a.detail, this.busy(), this.requestUpdate();
    }}
          @database-changed=${() => {
      !this.pending && !this.editPending && this.load();
    }}
        ></kaleidescape-transfers>
      </div>
      <div class="database-messages">
        ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : l}
        ${this.renderMutationRetry()}
      </div>
      <div
        class="page-tabs table-tabs"
        role="tablist"
        aria-label="Database tables"
        @keydown=${(a) => {
      t || this.tabKey(a, e);
    }}
      >
        ${e.map(
      (a) => r`<button
              role="tab"
              id=${`table-${a}`}
              aria-controls="database-rows"
              aria-selected=${this.table === a}
              tabindex=${this.table === a ? "0" : "-1"}
              ?disabled=${t}
              @click=${() => this.switchTable(a)}
            >
              ${X[a] ?? a}${this.page ? ` (${this.page.tables[a]})` : ""}
            </button>`
    )}
      </div>
      <div
        class="database-layout"
        role="tabpanel"
        id="database-rows"
        aria-labelledby=${`table-${this.table}`}
      >
        <section class="database-entries" aria-label="Database entries">
          <div class="card-head">
            <h2>${X[this.table] ?? this.table}</h2>
          </div>
          ${this.loading ? r`<p role="status">Loading database…</p>` : this.page ? r` <p class="muted">
                      Schema ${this.scope?.schema_version} · Dataset revision
                      ${this.page.revision} · ${this.page.tables[this.table]}
                      rows
                    </p>
                    <ul class="entry-list">
                      ${this.page.items.map(
      (a) => r`<li
                            class=${this.detail === a ? "selected" : ""}
                          >
                            ${s ? r`<input
                                    type="checkbox"
                                    aria-label=${`Select ${String(a.title)}`}
                                    ?disabled=${t}
                                    .checked=${this.selected.has(String(a.id))}
                                    @change=${(o) => {
        o.target.checked ? this.selected.add(String(a.id)) : this.selected.delete(String(a.id)), this.confirming = null, this.requestUpdate();
      }}
                                  />` : l}
                            <button
                              class="link entry-name"
                              ?disabled=${t}
                              @click=${() => this.showDetail(a)}
                            >
                              ${String(a.title ?? a.id ?? a.request_id ?? "Dataset metadata")}
                              ${s ? r`<small>${a.deleted_at ? "Deleted" : "Visible"}</small>` : l}
                            </button>
                          </li>`
    )}
                    </ul>
                    ${this.page.items.length ? l : r`<p>No rows.</p>`}
                    <div class="pagination database-pagination">
                      <small
                        >Rows
                        ${this.page.items.length ? this.page.offset + 1 : 0}–${this.page.offset + this.page.items.length}
                        · Up to 25
                        rows${s ? ` · ${this.selected.size} selected` : ""}</small
                      >
                      <div class="actions">
                        <button
                          ?disabled=${t || this.page.offset === 0}
                          @click=${() => this.load()}
                        >
                          First
                        </button>
                        <button
                          ?disabled=${t || this.page.offset === 0}
                          @click=${() => this.load(Math.max(0, this.page.offset - 25), this.page.revision)}
                        >
                          Previous
                        </button>
                        <button
                          ?disabled=${t || !this.page.has_more}
                          @click=${() => this.load(this.page.offset + 25, this.page.revision)}
                        >
                          Next
                        </button>
                      </div>
                    </div>` : l}
        </section>
        <section class="database-detail" aria-label="Selected database entry">
          ${this.renderDetail(t)}
        </section>
      </div>
      <dialog
        id="purge-dialog"
        class="database-dialog"
        aria-labelledby="purge-title"
        @cancel=${this.closePurge}
      >
        <div class="card-head"><h2 id="purge-title">Permanent purge</h2></div>
        <p>
          Remove viewing entries and associated sessions, edit audit references,
          and cached response content. This cannot be undone here. Backups,
          exports, and HA Recorder history remain.
        </p>
        ${this.scope?.tracking_enabled ? r`<p class="warning">Disable automatic tracking in Settings before purging.</p>` : l}
        ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.pending ? r`<div class="warning" role="status">
                ${this.saving ? "Purging…" : "The purge result is unconfirmed. Retry the exact request to confirm it."}
                <div class="actions">
                  <button ?disabled=${this.saving} @click=${() => this.purge()}>
                    Retry same purge
                  </button>
                  <button ?disabled=${this.saving} @click=${this.discardRetry}>
                    Discard retry & refresh
                  </button>
                </div>
              </div>` : l}
        <div class="actions">
          <button
            class="danger"
            ?disabled=${t || !!this.scope?.tracking_enabled || !this.selected.size}
            @click=${() => {
      this.confirming = "selected", this.confirmation = "", this.requestUpdate();
    }}
          >
            Purge selected (${this.selected.size})
          </button>
          <button
            class="danger"
            ?disabled=${t || !!this.scope?.tracking_enabled || !this.page?.tables.viewings}
            @click=${() => {
      this.confirming = "all", this.confirmation = "", this.requestUpdate();
    }}
          >
            Purge all entries
          </button>
        </div>
        ${this.confirming && !this.pending ? r`<form @submit=${this.purge}>
                <h3>
                  ${this.confirming === "all" ? "Permanently purge all entries?" : `Permanently purge ${this.selected.size} selected entries?`}
                </h3>
                <label
                  >Type ${this.confirming === "all" ? "PURGE ALL" : "PURGE"} to
                  confirm
                  <input
                    name="purge_confirmation"
                    autocomplete="off"
                    .value=${this.confirmation}
                    ?disabled=${t}
                    @input=${(a) => {
      this.confirmation = a.target.value, this.requestUpdate();
    }}
                  />
                </label>
                <div class="actions dialog-footer">
                  <button
                    type="submit"
                    class="danger"
                    ?disabled=${t || this.confirmation !== (this.confirming === "all" ? "PURGE ALL" : "PURGE")}
                  >
                    Confirm permanent purge
                  </button>
                </div>
              </form>` : l}
        <div class="actions dialog-footer">
          <button
            ?disabled=${this.saving || !!this.pending}
            @click=${this.closePurge}
          >
            Cancel purge
          </button>
        </div>
      </dialog>
    </section>`;
  }
};
F.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, F.styles = [
  C,
  O`
      :host {
        min-height: 0;
      }
    `
];
let nt = F;
customElements.get("kaleidescape-advanced") || customElements.define("kaleidescape-advanced", nt);
const be = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["writer", "Writer", "writers"],
  ["studio", "Studio", "studios"],
  ["rating", "Rating", "rating"]
], At = {
  watched: "Watched",
  unwatched: "Unwatched",
  in_progress: "In progress",
  unknown: "Unknown"
}, V = class V extends y {
  constructor() {
    super(...arguments), this.bound = "", this.generation = 0, this.listRequest = 0, this.statusRequest = 0, this.filters = {
      query: "",
      sort: "name",
      descending: !1
    }, this.applied = { ...this.filters }, this.loading = !1, this.requesting = !1, this.error = "", this.notice = "", this.coverRequest = 0, this.visibility = () => {
      clearTimeout(this.timer), document.hidden ? this.clearCover() : (this.refreshStatus(), this.selected && this.loadCover(this.selected));
    };
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}`;
    this.boundClient === this.client && this.bound === e || (this.clear(), this.boundClient = this.client, this.bound = e, this.client && this.scope?.library_enabled && (this.load(), this.refreshStatus()));
  }
  clearCover() {
    this.coverRequest++, this.coverController?.abort(), this.coverController = void 0, this.cover && URL.revokeObjectURL(this.cover), this.cover = void 0;
  }
  clear() {
    this.generation++, this.listRequest++, clearTimeout(this.timer), this.clearCover(), this.page = this.info = this.selected = void 0, this.filters = { query: "", sort: "name", descending: !1 }, this.applied = { ...this.filters }, this.loading = this.requesting = !1, this.error = this.notice = "", this.requestUpdate();
  }
  fail(t) {
    const e = g(t);
    (e === "unauthorized" || e === "library_disabled") && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        e === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    )), this.error = S(t), this.requestUpdate();
  }
  async load(t = 0) {
    if (!this.client || !this.scope?.library_enabled) return;
    const e = this.generation, i = ++this.listRequest;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const s = await this.client.libraryList(this.scope, {
        ...this.applied,
        offset: t,
        ...t && this.page ? { revision: this.page.revision } : {}
      });
      if (e !== this.generation || i !== this.listRequest)
        return;
      this.page = s;
      const a = s.items.find((o) => o.id === this.selected?.id) ?? s.items[0];
      this.selected = a, a ? this.loadCover(a) : this.clearCover();
    } catch (s) {
      e === this.generation && i === this.listRequest && this.fail(s);
    } finally {
      e === this.generation && i === this.listRequest && (this.loading = !1, this.requestUpdate());
    }
  }
  async refreshStatus() {
    if (!this.client || !this.scope?.library_enabled || document.hidden || !this.isConnected)
      return;
    clearTimeout(this.timer);
    const t = this.generation, e = ++this.statusRequest;
    let i = !1;
    try {
      const s = await this.client.libraryInfo(this.scope);
      if (t !== this.generation || e !== this.statusRequest)
        return;
      this.info = s, this.page && this.page.revision !== s.revision && !this.loading && this.load();
    } catch (s) {
      i = g(s) === "unauthorized", t === this.generation && e === this.statusRequest && this.fail(s);
    } finally {
      t === this.generation && e === this.statusRequest && this.isConnected && !i && !document.hidden && (this.timer = setTimeout(
        () => {
          this.refreshStatus();
        },
        this.info?.phase === "idle" ? 3e4 : 5e3
      ), this.requestUpdate());
    }
  }
  async sync() {
    if (!this.client || !this.scope || this.requesting) return;
    const t = this.generation;
    this.requesting = !0, this.error = this.notice = "", this.requestUpdate();
    try {
      if (await this.client.librarySync(this.scope), t !== this.generation) return;
      this.notice = "Library sync requested. Cached titles remain available while it runs.", this.refreshStatus();
    } catch (e) {
      t === this.generation && this.fail(e);
    } finally {
      t === this.generation && (this.requesting = !1, this.requestUpdate());
    }
  }
  async loadCover(t) {
    if (this.clearCover(), this.requestUpdate(), !this.client || !this.scope || !t.artwork_key || document.hidden)
      return;
    const e = this.generation, i = this.coverRequest, s = this.coverController = new AbortController(), a = setTimeout(() => s.abort(), 5e3);
    try {
      const o = await this.client.libraryArtwork(
        this.scope,
        t.artwork_key,
        s.signal
      );
      if (e !== this.generation || i !== this.coverRequest || document.hidden || !this.isConnected)
        return;
      this.cover = URL.createObjectURL(o), this.requestUpdate();
    } catch (o) {
      e === this.generation && i === this.coverRequest && g(o) === "unauthorized" && this.fail(o);
    } finally {
      clearTimeout(a), i === this.coverRequest && (this.coverController = void 0);
    }
  }
  date(t) {
    return t ? new Date(t).toLocaleString(void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    }) : "Not yet synced";
  }
  render() {
    const t = this.selected;
    return r`<section class="library-page">
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
          <button
            class="primary"
            ?disabled=${this.requesting || !!this.info && this.info.phase !== "idle"}
            @click=${this.sync}
          >
            Sync now
          </button>
        </div>
      </div>
      ${this.info ? r`<p class="muted">
                ${this.info.group_count} titles · ${this.info.title_count}
                versions · ${this.info.collection_count} collections · Last
                catalog sync: ${this.date(this.info.last_synced_at)}
                ${this.info.phase !== "idle" ? r`<br />${{ catalog: "Reading titles", collections: "Reading collections", details: "Fetching title data" }[this.info.phase] ?? "Syncing"}… ${this.info.total ? `${this.info.processed}/${this.info.total}` : ""}` : l}
              </p>
              <p class="muted">
                Played means watched; Paused takes priority. Collections last
                synced: ${this.date(this.info.collections_synced_at)}.
                ${this.info.collections_enabled ? "" : "Collection sync is disabled; retained statuses may be stale."}
              </p>
              ${this.info.artwork_enabled ? r`<p class="muted">Artwork cache: ${(this.info.artwork_bytes / 1048576).toFixed(1)} / ${(this.info.artwork_limit_bytes / 1048576).toFixed(0)} MiB</p>` : l}
              ${this.info.error ? r`<p class="warning" role="status">${S(new p(this.info.error))}</p>` : l}` : l}
      ${this.error ? r`<p class="error" role="alert">${this.error}<button @click=${() => this.load()}>Refresh results</button></p>` : l}
      ${this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : l}
      <section class="card">
        <form
          class="library-filters"
          @submit=${(e) => {
      e.preventDefault(), this.applied = { ...this.filters }, this.load();
    }}
        >
          <label class="full"
            >Search titles<input
              name="library_query"
              type="search"
              maxlength="500"
              .value=${String(this.filters.query ?? "")}
              @input=${(e) => {
      this.filters.query = e.target.value;
    }}
          /></label>
          ${be.map(
      ([e, i, s]) => r`<label
                >${i}
                ${["actor", "director", "writer", "studio"].includes(e) ? r`<input
                          name=${e}
                          list=${`facet-${e}`}
                          maxlength="500"
                          .value=${String(this.filters[e] ?? "")}
                          placeholder=${this.page?.facets[s]?.length ? "All · choose or type a name" : "No metadata available"}
                          ?disabled=${!this.page?.facets[s]?.length}
                          @input=${(a) => {
        this.filters[e] = a.target.value;
      }}
                        />
                        <datalist id=${`facet-${e}`}>
                          ${(this.page?.facets[s] ?? []).map((a) => r`<option .value=${a}></option>`)}
                        </datalist>` : r`<select
                        name=${e}
                        .value=${String(this.filters[e] ?? "")}
                        ?disabled=${!this.page?.facets[s]?.length}
                        @change=${(a) => {
        this.filters[e] = a.target.value;
      }}
                      >
                        <option value="">
                          ${this.page?.facets[s]?.length ? "All" : "No metadata available"}
                        </option>
                        ${(this.page?.facets[s] ?? []).map((a) => r`<option .value=${a}>${a}</option>`)}
                      </select>`}
              </label>`
    )}
          <label
            >Watched status<select
              name="library_status"
              .value=${String(this.filters.status ?? "")}
              @change=${(e) => {
      this.filters.status = e.target.value;
    }}
            >
              <option value="">All</option>
              ${Object.entries(At).map(([e, i]) => r`<option value=${e}>${i}</option>`)}
            </select></label
          >
          <label
            >Sort by<select
              name="library_sort"
              .value=${String(this.filters.sort)}
              @change=${(e) => {
      this.filters.sort = e.target.value;
    }}
            >
              <option value="name">Name</option>
              <option value="length">Length</option>
              <option value="watched">Watched status</option>
            </select></label
          >
          <label
            >Order<select
              name="library_order"
              .value=${this.filters.descending ? "desc" : "asc"}
              @change=${(e) => {
      this.filters.descending = e.target.value === "desc";
    }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select></label
          >
          <button type="submit" ?disabled=${this.loading}>
            Search & filter
          </button>
        </form>
        ${this.page?.truncated_facets.length ? r`<p class="library-note muted">Suggestions show the first 500 names; additional known names can be typed.</p>` : l}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Length</th>
                <th>Status</th>
                <th>Added on</th>
              </tr>
            </thead>
            <tbody>
              ${(this.page?.items ?? []).map(
      (e) => r`<tr class=${e.id === t?.id ? "selected" : ""}>
                    <td>
                      <button
                        class="link"
                        @click=${() => {
        this.selected = e, this.loadCover(e), this.requestUpdate();
      }}
                      >
                        ${e.title}</button
                      ><small>${e.year ?? ""} ${e.edition}</small>
                    </td>
                    <td>
                      ${e.duration_seconds === null ? "Unknown" : `${(e.duration_seconds / 60).toFixed(2)} min`}
                    </td>
                    <td>${At[e.watched_status]}</td>
                    <td>${this.date(e.first_seen)}</td>
                  </tr>`
    )}
            </tbody>
          </table>
        </div>
        ${this.page?.items.length ? l : r`<p class="empty" role="status">${this.loading ? "Loading library…" : "No cached titles match. Sync the library or adjust your filters."}</p>`}
        <div class="pagination">
          <small
            >${this.page?.total ?? 0} matching versions · Up to 50 per
            page</small
          >
          <div class="actions">
            <button
              ?disabled=${this.loading || !this.page?.offset}
              @click=${() => this.load()}
            >
              First
            </button>
            <button
              ?disabled=${this.loading || !this.page?.offset}
              @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - 50))}
            >
              Previous
            </button>
            <button
              ?disabled=${this.loading || !this.page?.has_more}
              @click=${() => this.load((this.page?.offset ?? 0) + 50)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      ${t ? r`<section
              class="card library-title"
              aria-label="Selected library title"
            >
              <div class="playback-layout">
                <div class="cover">
                  ${this.cover ? r`<img
                          src=${this.cover}
                          alt=${`Cover for ${t.title}`}
                          @error=${() => {
      this.clearCover(), this.requestUpdate();
    }}
                        />` : r`<span>No cached artwork</span>`}
                </div>
                <div>
                  <h2>${t.title}</h2>
                  <p>${t.synopsis || "No synopsis available."}</p>
                  <p class="metadata">
                    ${t.year ?? ""} · ${t.rating || "Unrated"} ·
                    ${t.edition}
                  </p>
                  ${[
      ["Collections", t.collections],
      ["Cast", t.actors],
      ["Directors", t.directors],
      ["Writers", t.writers],
      ["Studios", t.studios],
      ["Genres", t.genres]
    ].map(
      ([e, i]) => i.length ? r`<p>
                          <strong>${e}:</strong>
                          ${i.join(", ")}
                        </p>` : l
    )}
                  <p class="muted">
                    Added on ${this.date(t.first_seen)} · First detected by
                    Companion; purchase/download date is unknown.
                  </p>
                </div>
              </div>
            </section>` : l}
    </section>`;
  }
};
V.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, V.styles = [
  C,
  O`
      :host {
        min-height: 0;
      }
    `
];
let rt = V;
customElements.get("kaleidescape-library") || customElements.define("kaleidescape-library", rt);
const Z = [
  {
    id: "now-playing",
    label: "Now Playing",
    description: "Live playback and recording context."
  },
  {
    id: "journal",
    label: "Journal",
    description: "Review recordings and make corrections."
  },
  {
    id: "library",
    label: "Library",
    description: "Browse cached titles, collections, and source metadata."
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
], J = class J extends y {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.generation = 0, this.listRequest = 0, this.detailRequest = 0, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.nextCursor = null, this.history = [], this.page = 1, this.loading = !1, this.detailLoading = !1, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.error = "", this.lastError = "", this.notice = "", this.activePage = "journal", this.settingsBusy = !1, this.maintenanceBusy = !1;
  }
  willUpdate(t) {
    if (!(!t.has("hass") && !t.has("client")))
      if (this.hass) {
        if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
          this.bind(null);
          return;
        }
        (this.haConnection !== this.hass.connection || this.haUser !== this.hass.user.id) && (this.haConnection = this.hass.connection, this.haUser = this.hass.user.id, this.haClient = new Lt({
          callWS: (e) => this.hass.callWS(e),
          fetchWithAuth: (e, i) => this.hass.fetchWithAuth(e, i)
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
    this.generation++, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.pending = null, this.history = [], this.nextCursor = null, this.cursor = void 0, this.page = 1, this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.confirmDelete = !1, this.saving = !1, this.loading = !1, this.detailLoading = !1, this.sessionError = "", this.notice = "", this.activePage = "journal", this.settingsBusy = this.maintenanceBusy = !1;
  }
  bind(t) {
    this.api !== t && (this.clearPrivate(), this.api = t, this.error = "", this.requestUpdate(), t && this.refresh());
  }
  fail(t) {
    g(t) === "unauthorized" && this.clearPrivate(), this.lastError = g(t), this.error = S(t), this.requestUpdate();
  }
  dirty() {
    return this.draft && JSON.stringify(this.draft) !== JSON.stringify(this.initial);
  }
  discard() {
    return (!this.dirty() || window.confirm("Discard your unsaved changes?")) && (this.activePage !== "database" || (this.renderRoot.querySelector("kaleidescape-advanced")?.confirmNavigation() ?? !0)) && (this.activePage !== "settings" || (this.renderRoot.querySelector("kaleidescape-settings")?.confirmNavigation() ?? !0));
  }
  async switchPage(t) {
    t === "library" && !this.info?.library_enabled || t === this.activePage || this.loading || this.saving || this.pending || this.maintenanceBusy || this.settingsBusy || !this.discard() || (this.closeEditor(), this.activePage = t, this.error = this.notice = "", this.requestUpdate(), t === "journal" && (this.page = 1, this.history = [], await this.loadList()));
  }
  pageKey(t) {
    const e = Z.filter(
      (o) => o.id !== "library" || this.info?.library_enabled
    ), i = e.findIndex((o) => o.id === this.activePage), s = t.key === "ArrowRight" ? (i + 1) % e.length : t.key === "ArrowLeft" ? (i + e.length - 1) % e.length : t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : -1;
    if (s < 0) return;
    t.preventDefault(), this.switchPage(e[s].id).then(() => this.updateComplete).then(
      () => this.renderRoot.querySelector(`#page-${this.activePage}`)?.focus()
    );
  }
  async refresh(t = !1) {
    if (!this.api || this.pending || !this.discard()) return;
    const e = this.api, i = ++this.generation;
    this.info = null, this.rows = [], this.closeEditor(), this.loading = !0, this.error = "", this.requestUpdate();
    try {
      let { entries: s } = await e.info();
      for (let a = 0; t && !s.length && a < 20; a++) {
        if (await new Promise((o) => setTimeout(o, 500)), i !== this.generation) return;
        ({ entries: s } = await e.info());
      }
      if (i !== this.generation) return;
      if (!s.length) throw new p("not_ready");
      if (s[0].api_version !== 1) throw new p("not_ready");
      if (this.info = s[0], !this.info.permissions.edit) return;
      this.history = [], this.cursor = void 0, this.page = 1, await this.loadList();
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async loadList(t) {
    if (!this.api || !this.info) return;
    const e = this.api, i = this.info, s = this.generation, a = ++this.listRequest;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const o = await e.list(i, this.query, this.status, t);
      if (s !== this.generation || a !== this.listRequest)
        return;
      this.rows = o.items, this.cursor = t, this.nextCursor = o.next_cursor, this.info = { ...this.info, revision: o.revision };
    } catch (o) {
      s === this.generation && a === this.listRequest && (this.rows = [], this.nextCursor = null, this.fail(o));
    } finally {
      s === this.generation && a === this.listRequest && (this.loading = !1, this.requestUpdate());
    }
  }
  async selectRecord(t) {
    if (!this.api || !this.info || this.pending || !this.discard()) return;
    this.closeEditor();
    const e = this.api, i = this.info, s = this.generation, a = ++this.detailRequest;
    this.detailLoading = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const o = await e.get(i, t);
      if (s !== this.generation || a !== this.detailRequest)
        return;
      this.selected = o, this.draft = P(o), this.initial = { ...this.draft }, this.detailLoading = !1, this.requestUpdate();
      try {
        const h = await e.sessions(i, t);
        s === this.generation && a === this.detailRequest && (this.sessions = h);
      } catch (h) {
        s === this.generation && a === this.detailRequest && (g(h) === "unauthorized" ? this.fail(h) : this.sessionError = "Session details could not be loaded.");
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
    this.pending || !this.discard() || (this.closeEditor(), this.draft = P(), this.initial = { ...this.draft }, this.error = "", this.notice = "", this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector("#title")?.focus()
    ));
  }
  input(t, e) {
    this.draft && (this.draft = {
      ...this.draft,
      [t]: e.target.value
    }, this.requestUpdate());
  }
  async save(t) {
    if (t.preventDefault(), !(!this.api || !this.info || !this.draft || this.pending || this.saving || !t.target.reportValidity()))
      try {
        const i = Ot(
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
        g(i) === "request_id_unavailable" ? this.fail(i) : (this.error = "Check the dates and numeric fields before saving.", this.requestUpdate());
      }
  }
  async deleteRecord() {
    if (!(!this.api || !this.info || !this.selected || this.pending))
      try {
        this.pending = this.api.prepare(this.info, "delete", {
          viewing_id: this.selected.id,
          expected_revision: this.selected.revision
        }), this.confirmDelete = !1, await this.commit();
      } catch (t) {
        this.fail(t);
      }
  }
  async commit() {
    if (!this.api || !this.pending || this.saving) return;
    const t = this.api, e = this.pending, i = this.generation;
    this.saving = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const s = await t.mutate(e);
      if (i !== this.generation) return;
      this.pending = null, this.closeEditor(), this.notice = s.viewing.deleted_at ? "Entry removed from the journal. Stored history is retained." : "Entry saved.", s.viewing.deleted_at || (this.selected = s.viewing, this.draft = P(s.viewing), this.initial = { ...this.draft }), this.page = 1, this.history = [], await this.loadList();
      try {
        const { entries: a } = await t.info();
        i === this.generation && a[0]?.dataset_id === this.info?.dataset_id && (this.info = a[0]);
      } catch (a) {
        i === this.generation && this.fail(a);
      }
    } catch (s) {
      if (i !== this.generation) return;
      ["invalid_request", "conflict", "unauthorized"].includes(
        g(s)
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
  date(t) {
    return new Date(t).toLocaleString(void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }
  bytes(t) {
    return `${(t / 1024 / 1024).toFixed(t < 1024 * 1024 ? 2 : 1)} MiB`;
  }
  async refreshInfo() {
    if (!this.api) return;
    const t = this.generation;
    try {
      const { entries: e } = await this.api.info();
      t === this.generation && e[0]?.dataset_id === this.info?.dataset_id && (this.info = e[0], this.requestUpdate());
    } catch (e) {
      t === this.generation && this.fail(e);
    }
  }
  renderEditor() {
    return this.detailLoading ? r`<div class="empty" role="status">Loading entry…</div>` : this.draft ? r`<form class="editor" @submit=${this.save}>
      <fieldset ?disabled=${this.saving || !!this.pending}>
        ${Nt(this.draft, (t, e) => this.input(t, e))}
        ${this.selected?.origin === "observed" ? r`<small>Only fields you change are marked as manual corrections. Session evidence is retained.</small>` : l}
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
                  </button>` : l}
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
            </div>` : l}
      ${this.selected ? r`<details>
              <summary>Record details & sessions</summary>
              <div class="metadata">
                Record ${this.selected.id}<br />Origin: ${this.selected.origin}
                · Revision ${this.selected.revision}<br />Updated
                ${this.date(this.selected.updated_at)}<br />Completion:
                ${this.selected.completion_reason ?? "Not completed"}
              </div>
              ${this.sessionError ? r`<p>${this.sessionError}</p>` : this.sessions ? this.sessions.items.length ? r` ${this.sessions.items.map((t) => r`<div class="session">${this.date(t.started_at)}<br />${(t.watched_seconds / 60).toFixed(2)} min watched · ${t.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${t.gap_count} timing gaps<br />${t.end_reason ?? "Open session"}</div>`)}
                        ${this.sessions.has_more ? r`<small>Showing the latest 100 sessions.</small>` : l}` : r`<p class="muted">
                          No recorded sessions for this entry.
                        </p>` : r`<p class="muted">
                        Session details have not been loaded. Reopen the entry
                        to load them.
                      </p>`}
            </details>` : l}
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
    const t = this.loading || this.saving || !!this.pending || this.maintenanceBusy || this.settingsBusy;
    return r`<main>
      <header>
        ${this.hass && this.narrow ? r`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : l}
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Kaleidescape Companion</h1>
          <p>
            ${Z.find((e) => e.id === this.activePage).description}
          </p>
        </div>
      </header>
      ${this.info?.permissions.edit ? r`<div
              class="page-tabs"
              role="tablist"
              aria-label="Companion pages"
              @keydown=${(e) => this.pageKey(e)}
            >
              ${Z.map((e) => r`<button id=${`page-${e.id}`} role="tab" aria-selected=${this.activePage === e.id} aria-controls="companion-page" tabindex=${this.activePage === e.id ? "0" : "-1"} ?disabled=${t || e.id === "library" && !this.info?.library_enabled} title=${e.id === "library" && !this.info?.library_enabled ? "Enable library sync in Settings" : l} @click=${() => this.switchPage(e.id)}>${e.label}</button>`)}
            </div>` : l}
      ${this.error ? r`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? r` <button ?disabled=${t} @click=${() => this.selectRecord(this.selected.id)}>Reload entry</button>` : l}</div>` : l}
      ${this.notice ? r`<div class="notice" role="status">${this.notice}</div>` : l}
      ${this.pending && !this.saving ? r`<div class="warning">
              Retry the same change to confirm its result. The form is locked to
              prevent duplicate writes.
              <div class="actions">
                <button @click=${this.commit}>Retry same change</button>
                <button @click=${this.inspectJournal}>
                  Discard retry & inspect journal
                </button>
              </div>
            </div>` : l}
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
                      ></kaleidescape-library>` : this.activePage === "database" ? r`<kaleidescape-advanced
                          .client=${this.api}
                          .scope=${this.info}
                          @access-denied=${() => this.fail(new p("unauthorized"))}
                          @maintenance-busy=${(e) => {
      this.maintenanceBusy = e.detail, this.requestUpdate();
    }}
                          @database-changed=${() => this.refreshInfo()}
                        ></kaleidescape-advanced>` : this.activePage === "settings" ? r`<kaleidescape-settings
                            .client=${this.api}
                            .scope=${this.info}
                            @access-denied=${() => this.fail(new p("unauthorized"))}
                            @settings-busy=${(e) => {
      this.settingsBusy = e.detail, this.requestUpdate();
    }}
                            @settings-saved=${() => {
      this.notice = "Settings saved. Reloading the integration…";
      const e = this.api;
      this.refresh(!0).then(() => {
        this.api === e && this.info && (this.notice = "Settings saved.", this.requestUpdate());
      });
    }}
                          ></kaleidescape-settings>` : this.activePage === "now-playing" ? r`<kaleidescape-now-playing
                              .client=${this.api}
                              .scope=${this.info}
                            ></kaleidescape-now-playing>` : r`<div class="section-head">
                                <h2>Journal</h2>
                                <button
                                  class="primary"
                                  ?disabled=${t}
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
                                      ?disabled=${t}
                                      @click=${() => this.refresh()}
                                    >
                                      Refresh
                                    </button>
                                  </div>
                                  <form
                                    class="filters"
                                    @submit=${(e) => {
      e.preventDefault(), this.query = this.searchText, this.status = this.filterStatus, this.page = 1, this.history = [], this.loadList();
    }}
                                  >
                                    <label
                                      >Search titles<input
                                        name="search"
                                        type="search"
                                        maxlength="500"
                                        .value=${this.searchText}
                                        ?disabled=${t}
                                        @input=${(e) => {
      this.searchText = e.target.value;
    }}
                                    /></label>
                                    <label
                                      >Status<select
                                        name="filter_status"
                                        .value=${this.filterStatus}
                                        ?disabled=${t}
                                        @change=${(e) => {
      this.filterStatus = e.target.value;
    }}
                                      >
                                        <option value="">All</option>
                                        <option value="partial">Partial</option>
                                        <option value="completed">
                                          Completed
                                        </option>
                                      </select></label
                                    >
                                    <button ?disabled=${t}>Search</button>
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
      (e) => r` <tr
                                                      class=${this.selected?.id === e.id ? "selected" : ""}
                                                    >
                                                      <td>
                                                        <button
                                                          class="link"
                                                          ?disabled=${this.saving || !!this.pending}
                                                          @click=${() => this.selectRecord(e.id)}
                                                        >
                                                          ${e.title}</button
                                                        ><small
                                                          >${this.date(e.started_at)}
                                                          ·
                                                          ${e.origin === "observed" ? "Recorded" : "Manual"}</small
                                                        >
                                                      </td>
                                                      <td>
                                                        <span
                                                          class=${`badge ${e.status === "completed" ? "complete" : ""}`}
                                                          >${e.status === "completed" ? "Completed" : "Partial"}</span
                                                        >
                                                      </td>
                                                      <td>
                                                        ${(e.watched_seconds / 60).toFixed(2)}
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
      this.page--, this.loadList(
        this.history.pop()
      );
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
                                </section>
                                <section
                                  class="card"
                                  aria-label="Viewing editor"
                                >
                                  <div class="card-head">
                                    <h2>
                                      ${this.selected ? "Edit viewing" : this.draft ? "New viewing" : "Viewing details"}
                                    </h2>
                                    ${this.dirty() ? r`<span class="badge">Unsaved</span>` : l}
                                  </div>
                                  ${this.renderEditor()}
                                </section>
                              </div> `}
              </section>` : r`<div class="empty" role="status">
                <strong
                  >${this.loading ? "Connecting to the journal…" : "Journal unavailable"}</strong
                >${this.loading ? l : r`<button @click=${() => this.refresh()}>Reload connection</button>`}
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
J.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, J.styles = C;
let ot = J;
customElements.get("kaleidescape-panel") || customElements.define("kaleidescape-panel", ot);
export {
  ot as KaleidescapePanel
};
