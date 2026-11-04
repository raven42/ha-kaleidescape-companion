const me = globalThis, Pt = me.ShadowRoot && (me.ShadyCSS === void 0 || me.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, jt = /* @__PURE__ */ Symbol(), Yt = /* @__PURE__ */ new WeakMap();
let $i = class {
  constructor(e, t, i) {
    if (this._$cssResult$ = !0, i !== jt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o;
    const t = this.t;
    if (Pt && e === void 0) {
      const i = t !== void 0 && t.length === 1;
      i && (e = Yt.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), i && Yt.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const Oi = (n) => new $i(typeof n == "string" ? n : n + "", void 0, jt), S = (n, ...e) => {
  const t = n.length === 1 ? n[0] : e.reduce((i, s, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[r + 1], n[0]);
  return new $i(t, n, jt);
}, Ni = (n, e) => {
  if (Pt) n.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (const t of e) {
    const i = document.createElement("style"), s = me.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = t.cssText, n.appendChild(i);
  }
}, Zt = Pt ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (const i of e.cssRules) t += i.cssText;
  return Oi(t);
})(n) : n;
const { is: Ii, defineProperty: Fi, getOwnPropertyDescriptor: Bi, getOwnPropertyNames: Vi, getOwnPropertySymbols: Hi, getPrototypeOf: Wi } = Object, Ve = globalThis, Gt = Ve.trustedTypes, Ji = Gt ? Gt.emptyScript : "", Ki = Ve.reactiveElementPolyfillSupport, ne = (n, e) => n, at = { toAttribute(n, e) {
  switch (e) {
    case Boolean:
      n = n ? Ji : null;
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
} }, xi = (n, e) => !Ii(n, e), Qt = { attribute: !0, type: String, converter: at, reflect: !1, useDefault: !1, hasChanged: xi };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), Ve.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let J = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Qt) {
    if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
      const i = /* @__PURE__ */ Symbol(), s = this.getPropertyDescriptor(e, i, t);
      s !== void 0 && Fi(this.prototype, e, s);
    }
  }
  static getPropertyDescriptor(e, t, i) {
    const { get: s, set: r } = Bi(this.prototype, e) ?? { get() {
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
    return this.elementProperties.get(e) ?? Qt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(ne("elementProperties"))) return;
    const e = Wi(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(ne("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(ne("properties"))) {
      const t = this.properties, i = [...Vi(t), ...Hi(t)];
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
      for (const s of i) t.unshift(Zt(s));
    } else e !== void 0 && t.push(Zt(e));
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
    return Ni(e, this.constructor.elementStyles), e;
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
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : at).toAttribute(t, i.type);
      this._$Em = e, r == null ? this.removeAttribute(s) : this.setAttribute(s, r), this._$Em = null;
    }
  }
  _$AK(e, t) {
    const i = this.constructor, s = i._$Eh.get(e);
    if (s !== void 0 && this._$Em !== s) {
      const r = i.getPropertyOptions(s), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : at;
      this._$Em = s;
      const d = o.fromAttribute(t, r.type);
      this[s] = d ?? this._$Ej?.get(s) ?? d, this._$Em = null;
    }
  }
  requestUpdate(e, t, i, s = !1, r) {
    if (e !== void 0) {
      const o = this.constructor;
      if (s === !1 && (r = this[e]), i ??= o.getPropertyOptions(e), !((i.hasChanged ?? xi)(r, t) || i.useDefault && i.reflect && r === this._$Ej?.get(e) && !this.hasAttribute(o._$Eu(e, i)))) return;
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
J.elementStyles = [], J.shadowRootOptions = { mode: "open" }, J[ne("elementProperties")] = /* @__PURE__ */ new Map(), J[ne("finalized")] = /* @__PURE__ */ new Map(), Ki?.({ ReactiveElement: J }), (Ve.reactiveElementVersions ??= []).push("2.1.2");
const Dt = globalThis, Xt = (n) => n, fe = Dt.trustedTypes, ei = fe ? fe.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, ki = "$lit$", P = `lit$${Math.random().toFixed(9).slice(2)}$`, _i = "?" + P, Yi = `<${_i}>`, V = document, de = () => V.createComment(""), he = (n) => n === null || typeof n != "object" && typeof n != "function", Mt = Array.isArray, Zi = (n) => Mt(n) || typeof n?.[Symbol.iterator] == "function", Ke = `[ 	
\f\r]`, ie = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ti = /-->/g, ii = />/g, D = RegExp(`>|${Ke}(?:([^\\s"'>=/]+)(${Ke}*=${Ke}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), si = /'/g, ai = /"/g, Ci = /^(?:script|style|textarea|title)$/i, Si = (n) => (e, ...t) => ({ _$litType$: n, strings: e, values: t }), a = Si(1), _ = Si(2), z = /* @__PURE__ */ Symbol.for("lit-noChange"), l = /* @__PURE__ */ Symbol.for("lit-nothing"), ri = /* @__PURE__ */ new WeakMap(), F = V.createTreeWalker(V, 129);
function qi(n, e) {
  if (!Mt(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ei !== void 0 ? ei.createHTML(e) : e;
}
const Gi = (n, e) => {
  const t = n.length - 1, i = [];
  let s, r = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", o = ie;
  for (let d = 0; d < t; d++) {
    const h = n[d];
    let c, m, p = -1, y = 0;
    for (; y < h.length && (o.lastIndex = y, m = o.exec(h), m !== null); ) y = o.lastIndex, o === ie ? m[1] === "!--" ? o = ti : m[1] !== void 0 ? o = ii : m[2] !== void 0 ? (Ci.test(m[2]) && (s = RegExp("</" + m[2], "g")), o = D) : m[3] !== void 0 && (o = D) : o === D ? m[0] === ">" ? (o = s ?? ie, p = -1) : m[1] === void 0 ? p = -2 : (p = o.lastIndex - m[2].length, c = m[1], o = m[3] === void 0 ? D : m[3] === '"' ? ai : si) : o === ai || o === si ? o = D : o === ti || o === ii ? o = ie : (o = D, s = void 0);
    const v = o === D && n[d + 1].startsWith("/>") ? " " : "";
    r += o === ie ? h + Yi : p >= 0 ? (i.push(c), h.slice(0, p) + ki + h.slice(p) + P + v) : h + P + (p === -2 ? d : v);
  }
  return [qi(n, r + (n[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), i];
};
class ce {
  constructor({ strings: e, _$litType$: t }, i) {
    let s;
    this.parts = [];
    let r = 0, o = 0;
    const d = e.length - 1, h = this.parts, [c, m] = Gi(e, t);
    if (this.el = ce.createElement(c, i), F.currentNode = this.el.content, t === 2 || t === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = F.nextNode()) !== null && h.length < d; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(ki)) {
          const y = m[o++], v = s.getAttribute(p).split(P), E = /([.?@])?(.*)/.exec(y);
          h.push({ type: 1, index: r, name: E[2], strings: v, ctor: E[1] === "." ? Xi : E[1] === "?" ? es : E[1] === "@" ? ts : He }), s.removeAttribute(p);
        } else p.startsWith(P) && (h.push({ type: 6, index: r }), s.removeAttribute(p));
        if (Ci.test(s.tagName)) {
          const p = s.textContent.split(P), y = p.length - 1;
          if (y > 0) {
            s.textContent = fe ? fe.emptyScript : "";
            for (let v = 0; v < y; v++) s.append(p[v], de()), F.nextNode(), h.push({ type: 2, index: ++r });
            s.append(p[y], de());
          }
        }
      } else if (s.nodeType === 8) if (s.data === _i) h.push({ type: 2, index: r });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(P, p + 1)) !== -1; ) h.push({ type: 7, index: r }), p += P.length - 1;
      }
      r++;
    }
  }
  static createElement(e, t) {
    const i = V.createElement("template");
    return i.innerHTML = e, i;
  }
}
function X(n, e, t = n, i) {
  if (e === z) return e;
  let s = i !== void 0 ? t._$Co?.[i] : t._$Cl;
  const r = he(e) ? void 0 : e._$litDirective$;
  return s?.constructor !== r && (s?._$AO?.(!1), r === void 0 ? s = void 0 : (s = new r(n), s._$AT(n, t, i)), i !== void 0 ? (t._$Co ??= [])[i] = s : t._$Cl = s), s !== void 0 && (e = X(n, s._$AS(n, e.values), s, i)), e;
}
class Qi {
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
    const { el: { content: t }, parts: i } = this._$AD, s = (e?.creationScope ?? V).importNode(t, !0);
    F.currentNode = s;
    let r = F.nextNode(), o = 0, d = 0, h = i[0];
    for (; h !== void 0; ) {
      if (o === h.index) {
        let c;
        h.type === 2 ? c = new ee(r, r.nextSibling, this, e) : h.type === 1 ? c = new h.ctor(r, h.name, h.strings, this, e) : h.type === 6 && (c = new is(r, this, e)), this._$AV.push(c), h = i[++d];
      }
      o !== h?.index && (r = F.nextNode(), o++);
    }
    return F.currentNode = V, s;
  }
  p(e) {
    let t = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(e, i, t), t += i.strings.length - 2) : i._$AI(e[t])), t++;
  }
}
class ee {
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
    e = X(this, e, t), he(e) ? e === l || e == null || e === "" ? (this._$AH !== l && this._$AR(), this._$AH = l) : e !== this._$AH && e !== z && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : Zi(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== l && he(this._$AH) ? this._$AA.nextSibling.data = e : this.T(V.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: t, _$litType$: i } = e, s = typeof i == "number" ? this._$AC(e) : (i.el === void 0 && (i.el = ce.createElement(qi(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(t);
    else {
      const r = new Qi(s, this), o = r.u(this.options);
      r.p(t), this.T(o), this._$AH = r;
    }
  }
  _$AC(e) {
    let t = ri.get(e.strings);
    return t === void 0 && ri.set(e.strings, t = new ce(e)), t;
  }
  k(e) {
    Mt(this._$AH) || (this._$AH = [], this._$AR());
    const t = this._$AH;
    let i, s = 0;
    for (const r of e) s === t.length ? t.push(i = new ee(this.O(de()), this.O(de()), this, this.options)) : i = t[s], i._$AI(r), s++;
    s < t.length && (this._$AR(i && i._$AB.nextSibling, s), t.length = s);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(!1, !0, t); e !== this._$AB; ) {
      const i = Xt(e).nextSibling;
      Xt(e).remove(), e = i;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class He {
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
    if (r === void 0) e = X(this, e, t, 0), o = !he(e) || e !== this._$AH && e !== z, o && (this._$AH = e);
    else {
      const d = e;
      let h, c;
      for (e = r[0], h = 0; h < r.length - 1; h++) c = X(this, d[i + h], t, h), c === z && (c = this._$AH[h]), o ||= !he(c) || c !== this._$AH[h], c === l ? e = l : e !== l && (e += (c ?? "") + r[h + 1]), this._$AH[h] = c;
    }
    o && !s && this.j(e);
  }
  j(e) {
    e === l ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class Xi extends He {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === l ? void 0 : e;
  }
}
class es extends He {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== l);
  }
}
class ts extends He {
  constructor(e, t, i, s, r) {
    super(e, t, i, s, r), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = X(this, e, t, 0) ?? l) === z) return;
    const i = this._$AH, s = e === l && i !== l || e.capture !== i.capture || e.once !== i.once || e.passive !== i.passive, r = e !== l && (i === l || s);
    s && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class is {
  constructor(e, t, i) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    X(this, e);
  }
}
const ss = { I: ee }, as = Dt.litHtmlPolyfillSupport;
as?.(ce, ee), (Dt.litHtmlVersions ??= []).push("3.3.3");
const rs = (n, e, t) => {
  const i = t?.renderBefore ?? e;
  let s = i._$litPart$;
  if (s === void 0) {
    const r = t?.renderBefore ?? null;
    i._$litPart$ = s = new ee(e.insertBefore(de(), r), r, void 0, t ?? {});
  }
  return s._$AI(n), s;
};
const Ot = globalThis;
let x = class extends J {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = rs(t, this.renderRoot, this.renderOptions);
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
x._$litElement$ = !0, x.finalized = !0, Ot.litElementHydrateSupport?.({ LitElement: x });
const ns = Ot.litElementPolyfillSupport;
ns?.({ LitElement: x });
(Ot.litElementVersions ??= []).push("4.2.2");
const q = S`
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
function L(n) {
  const e = {
    add: _`<path d="M12 4v16M4 12h16"/>`,
    search: _`<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>`,
    filter: _`<path d="M3 5h18l-7 8v6l-4 2v-8z"/>`,
    clear: _`<path d="m6 6 12 12M18 6 6 18"/>`,
    shuffle: _`<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>`,
    ascending: _`<path d="M7 20V4m-4 4 4-4 4 4m3-1h7m-7 5h5m-5 5h3"/>`,
    descending: _`<path d="M7 4v16m-4-4 4 4 4-4m3-9h3m-3 5h5m-5 5h7"/>`,
    options: _`<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="18" r="2" fill="var(--surface)"/>`,
    first: _`<path d="M5 5v14m13-14-7 7 7 7"/>`,
    previous: _`<path d="m15 5-7 7 7 7"/>`,
    next: _`<path d="m9 5 7 7-7 7"/>`,
    collection: _`<path fill="#ffca28" stroke="#ffca28" d="M6 2h12v20l-6-4-6 4z"/><path fill="#302b16" stroke="none" d="m12 5 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z"/>`,
    edit: _`<path d="m15 4 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16zM4 20h8"/>`,
    scrape: _`<path d="M3 9h15v4M3 9l-1-4 14-3 1 4zM6 4l3 4m3-5 3 4M3 9v11h8"/><circle cx="16" cy="16" r="4"/><path d="m19 19 3 3M6 13h3m-3 3h2"/>`,
    artwork: _`<rect x="8" y="2" width="13" height="9" rx="1"/><path d="m10 9 3-3 2 2 2-3 2 2"/><rect x="3" y="14" width="13" height="9" rx="1"/><path d="m5 21 3-3 2 2 2-3 2 2M3 10V6h3m0 0L4 4m2 2L4 8m17 6v4h-3m0 0 2-2m-2 2 2 2"/>`,
    power: _`<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>`,
    play: _`<path fill="currentColor" stroke="none" d="M7 3v18l15-9z"/>`
  };
  return _`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e[n]}</svg>`;
}
const Nt = S`
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
function It(n, e, t, i, s = "") {
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
      ${L(e)}<span class="icon-action-label">${n}</span></button
    ><span class="action-tooltip" id="action-tooltip" role="tooltip"
      >${n}</span
    ></span
  >`;
}
function k(n, e = !1) {
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
function C(n) {
  const e = n.currentTarget;
  if (n.target !== e) return;
  const t = e.getBoundingClientRect();
  n.clientX >= t.left && n.clientX <= t.right && n.clientY >= t.top && n.clientY <= t.bottom || e.dispatchEvent(new Event("cancel", { cancelable: !0 })) && e.close();
}
const ye = class ye extends x {
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
          ${L("search")}
        </button>
        <button
          type="button"
          aria-label="Clear Journal search and filters"
          title="Clear search and filters"
          ?disabled=${this.disabled}
          @click=${() => this.signal("journal-clear")}
        >
          ${L("clear")}
        </button>
        ${this.allowAdd ? a`<button type="button" aria-label="Add viewing" title="Add viewing" ?disabled=${this.disabled} @click=${() => this.signal("journal-add")}>${L("add")}</button>` : ""}
        <button
          type="button"
          aria-label="Journal options"
          title="Options"
          aria-haspopup="dialog"
          ?disabled=${this.disabled}
          class=${this.filtered ? "active" : ""}
          @click=${() => this.signal("journal-open-options")}
        >
          ${L("options")}
        </button>
      </div>
      <dialog
        aria-labelledby="journal-search-title"
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="journal-search-title">Search Journal</h2>
          ${k((e) => this.close(e))}
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
ye.properties = {
  value: {},
  disabled: { type: Boolean },
  allowAdd: { type: Boolean },
  filtered: { type: Boolean },
  filterLabel: {},
  context: { attribute: !1 },
  scopeKey: {}
}, ye.styles = [
  q,
  S`
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
let rt = ye;
customElements.get("kaleidescape-journal-shortcuts") || customElements.define("kaleidescape-journal-shortcuts", rt);
function G() {
  const n = window.innerWidth;
  return n <= 600 ? "mobile" : n <= 1024 ? "tablet" : "desktop";
}
class b extends Error {
  constructor(e) {
    super(e), this.code = e;
  }
}
const g = "kaleidescape_companion", os = 15e3, f = ({ entry_id: n, dataset_id: e }) => ({
  entry_id: n,
  dataset_id: e
}), ls = 256 * 1024 * 1024, ni = 5 * 1024 * 1024, ds = 32 * 1024 * 1024;
function Q() {
  const n = globalThis.crypto;
  if (typeof n?.randomUUID == "function") return n.randomUUID();
  if (typeof n?.getRandomValues != "function")
    throw new b("request_id_unavailable");
  const e = n.getRandomValues(new Uint8Array(16));
  e[6] = e[6] & 15 | 64, e[8] = e[8] & 63 | 128;
  const t = Array.from(
    e,
    (i) => i.toString(16).padStart(2, "0")
  ).join("");
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
}
async function ge(n, e, t) {
  const i = n.body?.getReader();
  if (!i) throw new b("storage_error");
  const s = [];
  let r = 0;
  try {
    for (; ; ) {
      const { value: o, done: d } = await i.read();
      if (d) break;
      if (r += o.byteLength, r > e) throw new b("export_too_large");
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
function w(n) {
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
    query_limit: "This search exceeded its execution budget. Refine the text or simplify the conditions and try again.",
    repair_limit: "Metadata repair exceeded its 10,000-entry or execution limit. No changes were saved.",
    query_syntax: "Check the field names, operators and quoted values in the condition.",
    database_page_too_large: "The database page is too large. Choose fewer rows per page.",
    library_page_too_large: "This library page is too large. Reduce entries per page and try again.",
    collection_disabled: "Enable Add to Collection and collection sync in Settings first.",
    collection_form: "The server’s collection add form was not recognized. Refresh or sync before starting another add.",
    collection_uncertain: "Check or acknowledge the previous unconfirmed collection add first.",
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
    tmdb_ambiguous: "TMDB returned more than one matching movie. No data was imported."
  }[u(n)] ?? "The connection was interrupted. The result could not be confirmed.";
}
async function M(n, e = os) {
  let t;
  try {
    return await Promise.race([
      n,
      new Promise((i, s) => {
        t = setTimeout(
          () => s(new b("connection_lost")),
          e
        );
      })
    ]);
  } finally {
    clearTimeout(t);
  }
}
class Ft {
  constructor(e) {
    this.transport = e;
  }
  call(e) {
    return M(this.transport.callWS(e));
  }
  controlInfo(e) {
    return this.call({ type: `${g}/control/info`, ...f(e) });
  }
  controlDiscover(e) {
    return M(
      this.transport.callWS({
        type: `${g}/control/discover`,
        ...f(e)
      }),
      7e4
    );
  }
  controlStatus(e, t) {
    return this.call({
      type: `${g}/control/status`,
      ...f(e),
      ...t ? { player_id: t } : {}
    });
  }
  controlPrepare(e, t, i, s) {
    return this.call({
      type: `${g}/control/prepare`,
      ...f(e),
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
      type: `${g}/control/acknowledge`,
      ...f(e),
      request_id: t,
      confirmation: "REVIEWED"
    });
  }
  metadataStatus(e, t = !1) {
    return this.call({
      type: `${g}/metadata/${t ? "sync" : "status"}`,
      ...f(e)
    });
  }
  titleScrapeOptions(e, t) {
    return this.call({
      type: `${g}/metadata/title/options`,
      ...f(e),
      title_id: t
    });
  }
  titleScrapePreview(e, t, i, s = "", r = "") {
    return M(
      this.transport.callWS({
        type: `${g}/metadata/title/preview`,
        ...f(e),
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
        type: `${g}/metadata/title/search`,
        ...f(e),
        title_id: t,
        provider: i,
        query: s,
        ...r !== void 0 ? { year: r } : {}
      }),
      185e3
    );
  }
  titleScrapeRefresh(e, t, i, s, r) {
    return M(
      this.transport.callWS({
        type: `${g}/metadata/title/refresh`,
        ...f(e),
        request_id: Q(),
        title_id: t,
        provider: i,
        query: s,
        ...r !== void 0 ? { year: r } : {}
      }),
      185e3
    );
  }
  titleScrapeRefreshChoice(e, t, i, s, r) {
    return M(
      this.transport.callWS({
        type: `${g}/metadata/title/refresh_choice`,
        ...f(e),
        request_id: Q(),
        title_id: t,
        provider: i,
        search_id: s,
        choice: r
      }),
      185e3
    );
  }
  prepareMetadataAction(e, t) {
    return this.prepareCommand(e, "metadata/title/action", { data: t });
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
      type: `${g}/metadata/title/cancel`,
      ...f(e),
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
      throw new b("invalid_request");
    return this.raster(
      `/api/${g}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/metadata/review/${t}/image/${i}`,
      s
    );
  }
  metadataPreview(e) {
    return this.call({
      type: `${g}/journal/metadata/preview`,
      ...f(e)
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
      type: `${g}/library/edit/get`,
      ...f(e),
      title_id: t
    });
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
  uiPreferences(e, t = !1, i = "library", s = G()) {
    return this.call({
      type: `${g}/ui/${t ? "shared" : "preferences"}/get`,
      ...i !== "library" ? { area: i } : {},
      ...t ? {} : { profile: s },
      ...f(e)
    });
  }
  prepareUIPreferences(e, t, i, s, r = "library", o = G()) {
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
      type: `${g}/dashboard/preview`,
      ...f(e),
      request_id: t,
      name: i
    });
  }
  verifyTestDashboard(e, t) {
    return this.call({
      type: `${g}/dashboard/verify`,
      ...f(e),
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
    return this.call({ type: `${g}/info` });
  }
  list(e, t = "", i = "", s, r = "completed_at", o = !0, d = !1, h) {
    return this.call({
      type: `${g}/${h ? "library/viewings" : "journal/list"}`,
      ...h ? { title_id: h } : {},
      ...f(e),
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
      type: `${g}/journal/get`,
      ...f(e),
      viewing_id: t
    });
  }
  calendarMonth(e, t, i, s = "", r = "", o = !1, d) {
    return this.call({
      type: `${g}/journal/calendar`,
      ...f(e),
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
      type: `${g}/journal/calendar/get`,
      ...f(e),
      viewing_id: t
    });
  }
  viewingLibrary(e, t) {
    return this.call({
      type: `${g}/library/viewing`,
      ...f(e),
      viewing_id: t
    });
  }
  sessions(e, t) {
    return this.call({
      type: `${g}/journal/sessions`,
      ...f(e),
      viewing_id: t
    });
  }
  nowPlaying(e, t) {
    return this.call({
      type: `${g}/now_playing`,
      ...f(e),
      ...t ? { player_id: t } : {}
    });
  }
  libraryInfo(e) {
    return this.call({ type: `${g}/library/info`, ...f(e) });
  }
  libraryPurchaseTotals(e) {
    return this.call({
      type: `${g}/library/purchases/summary`,
      ...f(e)
    });
  }
  libraryList(e, t = {}) {
    return this.call({
      type: `${g}/library/list`,
      ...f(e),
      filters: t
    });
  }
  libraryVersions(e, t, i = 0, s) {
    return this.call({
      type: `${g}/library/versions`,
      ...f(e),
      title_id: t,
      offset: i,
      ...s === void 0 ? {} : { revision: s }
    });
  }
  librarySync(e) {
    return this.call({ type: `${g}/library/sync`, ...f(e) });
  }
  collectionTargets(e, t, i) {
    return this.call({
      type: `${g}/library/collections/targets`,
      ...f(e),
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
      type: `${g}/library/collections/check`,
      ...f(e),
      request_id: t
    });
  }
  collectionAcknowledge(e, t) {
    return this.call({
      type: `${g}/library/collections/acknowledge`,
      ...f(e),
      request_id: t,
      confirmation: "ACKNOWLEDGE"
    });
  }
  async libraryArtwork(e, t, i) {
    if (!/^[a-f0-9]{64}$/.test(t)) throw new b("invalid_request");
    return this.raster(
      `/api/${g}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/library/artwork/${t}`,
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
      throw await i.body?.cancel(), new b(
        [401, 403].includes(i.status) ? "unauthorized" : "not_found"
      );
    const s = i.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (!s || !["image/jpeg", "image/png", "image/webp"].includes(s))
      throw await i.body?.cancel(), new b("invalid_request");
    return ge(i, ni, s);
  }
  settingsTransfer(e, t, i, s = {}, r = "") {
    return this.call({
      ...f(e),
      type: `${g}/settings/transfer`,
      operation: t,
      categories: i,
      data: s,
      request_id: r
    });
  }
  settings(e, t, i = {}) {
    return this.call({
      ...i,
      ...f(e),
      type: `${g}/settings/${t}`
    });
  }
  inspect(e, t, i = 0, s, r) {
    return this.call({
      type: `${g}/database/inspect`,
      ...f(e),
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
      type: `${g}/database/import/search`,
      ...f(e),
      plan_id: t.plan_id,
      revision: t.revision,
      purchase_key: i,
      query: s
    });
  }
  matchImportPurchase(e, t, i, s) {
    return this.call({
      type: `${g}/database/import/match`,
      ...f(e),
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
  async previewImport(e, t, i) {
    const s = /\.(sqlite|sqlite3|db)$/i.test(t.name) ? "sqlite" : /\.json$/i.test(t.name) ? "json" : null;
    if (!s) throw new b("invalid_request");
    if (!t.size || t.size > ds)
      throw new b("import_too_large");
    const r = await this.transport.fetchWithAuth(
      `/api/${g}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/import/preview?format=${s}`,
      {
        method: "POST",
        body: t,
        signal: i,
        redirect: "error",
        cache: "no-store",
        headers: { "Content-Type": "application/octet-stream" }
      }
    );
    if (!r.ok) {
      const d = {
        401: "unauthorized",
        403: "unauthorized",
        413: "import_too_large",
        404: "not_found"
      };
      if (d[r.status]) throw new b(d[r.status]);
      const h = await r.json().catch(() => null);
      throw new b(h?.code ?? "connection_lost");
    }
    const o = await ge(
      r,
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
      throw new b("invalid_request");
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
      throw new b(
        [401, 403].includes(i.status) ? "unauthorized" : "not_ready"
      );
    }
    const s = i.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    return !s || !["image/jpeg", "image/png", "image/webp"].includes(s) ? (await i.body?.cancel(), null) : ge(i, ni, s);
  }
  librarySuggestions(e, t, i, s = !1) {
    return this.call({
      type: `${g}/library/suggest`,
      ...f(e),
      field: t,
      query: i,
      fuzzy: s
    });
  }
  librarySearch(e, t, i = !0) {
    return this.call({
      type: `${g}/library/search`,
      ...f(e),
      query: t,
      fuzzy: i
    });
  }
  calendarStatus(e) {
    return this.call({
      type: `${g}/calendar/status`,
      ...f(e)
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
      type: `${g}/calendar/maintain`,
      ...f(e),
      action: t,
      fingerprint: i,
      review_token: s,
      confirmation: t === "acknowledge" ? "ACKNOWLEDGE" : ""
    });
  }
  calendarCancel(e, t) {
    return this.call({
      type: `${g}/calendar/cancel`,
      ...f(e),
      job_id: t
    });
  }
  validateDatabaseQuery(e, t, i) {
    return this.call({
      type: `${g}/database/validate_query`,
      ...f(e),
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
      if (!i()) throw new b("not_ready");
      if (s && (d.revision !== s.revision || d.preferences_key !== s.preferences_key))
        throw new b("refresh_required");
      if (o += new TextEncoder().encode(JSON.stringify(d.items)).byteLength, r.length + d.items.length > 1e4 || o > 32 * 1024 * 1024)
        throw new b("library_page_too_large");
      if (r.push(...d.items), s = d, !d.has_more)
        return {
          ...d,
          items: r,
          offset: 0,
          limit: r.length,
          has_more: !1
        };
      if (!d.items.length) throw new b("refresh_required");
    }
    throw new b("not_ready");
  }
  prepare(e, t, i) {
    return this.prepareCommand(e, `journal/${t}`, i);
  }
  prepareCommand(e, t, i) {
    const s = structuredClone({
      ...i,
      ...f(e),
      type: `${g}/${t}`,
      request_id: Q()
    });
    return { scope: f(e), message: Object.freeze(s) };
  }
  mutate(e) {
    return this.call({ ...e.message });
  }
  async download(e, t, i) {
    const s = `/api/${g}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/export?format=${t}`, r = await this.transport.fetchWithAuth(s, {
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
      throw new b(o[r.status] ?? "storage_error");
    }
    return ge(
      r,
      ls,
      t === "json" ? "application/json" : "application/vnd.sqlite3"
    );
  }
}
function $(n, e, t = `${e}s`) {
  return `${n} ${n === 1 ? e : t}`;
}
function Ye(n = 0) {
  const e = Math.floor(n / 60);
  return `${Math.floor(e / 60)}h ${e % 60}m`;
}
function Bt(n, e, t = !!e) {
  const i = t ? e?.count : n?.month_viewing_count, s = t ? e?.watchedSeconds : n?.month_watched_seconds;
  return a`<span class=${t ? "calendar-totals-full" : ""}
      >Total Viewings ${n?.viewing_count ?? 0} ·
      ${t ? e?.month ?? "Selected Month" : "This Month"}
      ${i ?? "—"} · Watched Time: Total
      ${Ye(n?.watched_seconds)} ·
      ${t ? "Selected Month" : "This Month"}
      ${s === void 0 && t ? "—" : Ye(s)}</span
    >
    ${t ? a`<span class="calendar-totals-compact">${i === void 0 ? "— viewings" : $(i, "viewing")} · ${s === void 0 ? "—" : Ye(s)} watched</span>` : l}`;
}
function Vt(n, e) {
  return n ? n.error ? a`<span class="error" role="alert"
        >${n.error} <button @click=${e}>Retry month</button></span
      >` : n.loading ? a`<span role="status">Loading month…</span>` : n.empty ? a`<span class="calendar-empty-notice" role="status"
            >No viewings match this month</span
          >` : l : l;
}
function Ei(n, e, t, i = !1) {
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
function Ri(n, e) {
  return a`<h3 class="journal-title">${n.title}</h3>
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
const Li = S`
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
`, zi = S`
  ${Li}
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
`, hs = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20type='positive'%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(1.33,%200)'%3e%3cg%20transform='translate(0,%2016.27)'%3e%3cmask%20id='mask-2'%20fill='white'%3e%3cpolygon%20points='0.000109100102%200.246970954%2077.0827837%200.246970954%2077.0827837%2063.7145228%200.000109100102%2063.7145228'%3e%3c/polygon%3e%3c/mask%3e%3cpath%20d='M77.0137759,27.0426556%20C76.2423237,14.6741909%2069.9521992,5.42041494%2060.4876349,0.246970954%20C60.5414108,0.548381743%2060.273195,0.925145228%2059.9678008,0.791701245%20C53.7772614,-1.91634855%2043.2753527,6.84780083%2035.9365975,2.25825726%20C35.9917012,3.90539419%2035.6700415,11.940249%2024.3515353,12.4063071%20C24.0843154,12.4172614%2023.9372614,12.1443983%2024.1062241,11.9512033%20C25.619917,10.2247303%2027.1482158,5.85360996%2024.9507054,3.5233195%20C20.2446473,7.74041494%2017.5117012,9.32746888%208.48829876,7.23319502%20C2.71103734,13.2740249%20-0.562655602,21.5419087%200.08,31.8413278%20C1.39120332,52.86639%2021.0848133,64.8846473%2040.9165145,63.6471369%20C60.746888,62.4106224%2078.3253112,48.0677178%2077.0137759,27.0426556'%20fill='%23FA320A'%20mask='url(%23mask-2)'%3e%3c/path%3e%3c/g%3e%3cpath%20d='M40.8717012,11.4648963%20C44.946722,10.49361%2056.6678838,11.3702905%2060.4232365,16.3518672%20C60.6486307,16.6506224%2060.3312863,17.2159336%2059.9678008,17.0572614%20C53.7772614,14.3492116%2043.2753527,23.113361%2035.9365975,18.5238174%20C35.9917012,20.1709544%2035.6700415,28.2058091%2024.3515353,28.6718672%20C24.0843154,28.6828216%2023.9372614,28.4099585%2024.1062241,28.2167635%20C25.619917,26.4902905%2027.1478838,22.1191701%2024.9507054,19.7888797%20C19.8243983,24.3827386%2017.0453112,25.8589212%205.91900415,22.8514523%20C5.55485477,22.753195%205.67900415,22.1679668%206.06639004,22.020249%20C8.16929461,21.2165975%2012.933444,17.6965975%2017.4406639,16.1450622%20C18.2987552,15.8499585%2019.1541909,15.6209129%2019.9890456,15.4878008%20C15.02639,15.0443154%2012.7893776,14.3541909%209.63286307,14.8302075%20C9.28697095,14.8823237%209.05195021,14.479668%209.26639004,14.2034855%20C13.5193361,8.7253112%2021.3540249,7.07087137%2026.1878838,9.98107884%20C23.2082988,6.28912863%2020.8743568,3.34473029%2020.8743568,3.34473029%20L26.4046473,0.203485477%20C26.4046473,0.203485477%2028.6894606,5.30821577%2030.3518672,9.02340249%20C34.4657261,2.94506224%2042.119834,2.38406639%2045.3536929,6.69676349%20C45.5455602,6.95302905%2045.3450622,7.31751037%2045.0247303,7.30987552%20C42.3926971,7.24580913%2040.9434025,9.63983402%2040.833527,11.4605809%20L40.8717012,11.4648963'%20fill='%2300912D'%3e%3c/path%3e%3c/g%3e%3c/svg%3e", cs = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20type='negative'%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(0,%201.23)'%3e%3cg%3e%3cmask%20id='mask-2'%20fill='white'%3e%3cpolygon%20points='0%200.161950465%2079.7417075%200.161950465%2079.7417075%2077.522807%200%2077.522807'%3e%3c/polygon%3e%3c/mask%3e%3cpath%20d='M71.4638596,70.225614%20C56.3459649,71.0192982%2053.2568421,53.7203509%2047.325614,53.8435088%20C44.7982456,53.8964912%2042.8063158,56.5389474%2043.6810526,59.6185965%20C44.1621053,61.3115789%2045.4964912,63.794386%2046.337193,65.3350877%20C49.302807,70.7719298%2044.9185965,76.9245614%2039.7880702,77.4449123%20C31.2621053,78.3098246%2027.705614,73.3638596%2027.925614,68.3007018%20C28.1729825,62.6168421%2032.9922807,56.8091228%2028.0494737,54.3378947%20C22.8694737,51.7480702%2018.6585965,61.8754386%2013.7017544,64.1357895%20C9.2154386,66.1817544%202.9877193,64.5954386%200.773684211,59.6136842%20C-0.781403509,56.1129825%20-0.498596491,49.3722807%206.42526316,46.8003509%20C10.7501754,45.1940351%2020.3880702,48.9010526%2020.8824561,44.205614%20C21.4522807,38.7929825%2010.7575439,38.3364912%207.53754386,37.0385965%20C1.84,34.7424561%20-1.52280702,29.8291228%201.11192982,24.5582456%20C3.08877193,20.6045614%208.90526316,18.9957895%2013.3449123,20.7277193%20C18.6635088,22.8024561%2019.517193,28.3189474%2022.2421053,30.6129825%20C24.5894737,32.5901754%2027.8021053,32.8375439%2029.9031579,31.4782456%20C31.4526316,30.4754386%2031.9684211,28.2729825%2031.3838596,26.2610526%20C30.6084211,23.5901754%2028.5505263,21.9235088%2026.542807,20.2905263%20C22.9698246,17.3859649%2017.925614,14.8884211%2020.9768421,6.96035088%20C23.4778947,0.463157895%2030.8133333,0.229122807%2030.8133333,0.229122807%20C33.7277193,-0.0985964912%2036.3375439,0.781403509%2038.4642105,2.68140351%20C41.3073684,5.22140351%2041.8610526,8.61649123%2041.3852632,12.2385965%20C40.9505263,15.5449123%2039.7803509,18.4407018%2039.1701754,21.7164912%20C38.4621053,25.5196491%2040.4947368,29.3519298%2044.3603509,29.5010526%20C49.4449123,29.6975439%2050.9694737,25.7894737%2051.5915789,23.3122807%20C52.5024561,19.6877193%2053.6978947,16.322807%2057.0617544,14.2035088%20C61.8894737,11.1617544%2068.5954386,11.8284211%2071.7066667,17.674386%20C74.1677193,22.3%2073.3775439,28.6677193%2069.6024561,32.1449123%20C67.9087719,33.7045614%2065.8722807,34.254386%2063.6694737,34.2698246%20C60.5105263,34.2922807%2057.3529825,34.2147368%2054.4207018,35.6929825%20C52.4245614,36.6989474%2051.5547368,38.3382456%2051.5550877,40.5354386%20C51.5550877,42.6768421%2052.6698246,44.0754386%2054.4761404,44.985614%20C57.8782456,46.7003509%2061.6336842,47.0508772%2065.3087719,47.694386%20C70.6382456,48.6277193%2075.3242105,50.5049123%2078.3326316,55.4505263%20C78.3596491,55.4940351%2078.3859649,55.5378947%2078.4115789,55.5821053%20C81.8666667,61.4375439%2078.2533333,69.8687719%2071.4638596,70.225614'%20fill='%230AC855'%20mask='url(%23mask-2)'%3e%3c/path%3e%3c/g%3e%3c/g%3e%3c/svg%3e", ps = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(10.1,%200)'%3e%3cg%3e%3cmask%20id='mask-2'%20fill='white'%3e%3cpolygon%20points='0.0178438662%200.124907063%2059.6019307%200.124907063%2059.6019307%2079.9821561%200.0178438662%2079.9821561'%3e%3c/polygon%3e%3c/mask%3e%3cpath%20d='M2.53115242,19.0988848%20C2.76163569,23.9952416%2014.8892193,27.8762825%2029.8007435,27.7912268%20C42.8237918,27.7168773%2053.6874349,24.6411896%2056.3485502,20.6004461%20C55.7421561,19.9265428%2054.904684,19.4643866%2053.9613383,19.3391822%20C53.9714498,19.220223%2053.9779926,19.1003717%2053.9773978,18.9787361%20C53.9663941,17.0423792%2052.5460223,15.4477323%2050.695316,15.1503346%20C50.7440892,14.8999257%2050.7696654,14.6408922%2050.7681784,14.3759108%20C50.7559851,12.2194796%2048.9977695,10.481487%2046.8413383,10.4936803%20C46.7925651,10.4939777%2046.7449814,10.4999257%2046.6965056,10.5020074%20C46.8344981,10.0987361%2046.9118216,9.66780669%2046.9094424,9.21784387%20C46.8969517,7.06141264%2045.1390335,5.32342007%2042.9826022,5.33561338%20C42.4877323,5.33858736%2042.0169517,5.43702602%2041.5821561,5.60743494%20C40.9653532,4.44639405%2039.7811152,3.63717472%2038.4002974,3.54379182%20C38.1597026,1.60743494%2036.5055762,0.113605948%2034.506171,0.124843367%20C33.247881,0.13204461%2032.1350186,0.736356877%2031.4263197,1.66453532%20C30.7075093,0.882379182%2029.6773234,0.391672862%2028.5314498,0.398215613%20C26.3750186,0.410408922%2024.637026,2.16862454%2024.6492193,4.32475836%20C24.6515985,4.73665428%2024.718513,5.13249071%2024.8386617,5.50453532%20C23.9586617,5.66780669%2023.1848327,6.12520446%2022.6191822,6.77144981%20C22.1701115,5.09888476%2020.642974,3.86973978%2018.8297398,3.8798513%20C17.1357621,3.88966543%2015.7040892,4.97873606%2015.172342,6.48981413%20C13.7332342,7.07182156%2012.7202974,8.48356877%2012.7298141,10.1302602%20C12.7318959,10.4960595%2012.7878067,10.8481784%2012.8838662,11.1836431%20C12.398513,10.9713011%2011.8634944,10.852342%2011.2996283,10.8556134%20C9.5994052,10.8654275%208.16327138,11.9622305%207.63598513,13.4822305%20C7.13040892,13.2472862%206.56832714,13.1137546%205.973829,13.1173234%20C3.81739777,13.1295167%202.07910781,14.8874349%202.09153162,17.0438662%20C2.09546468,17.7549442%202.29263941,18.4187361%202.62810409,18.9909294%20C2.59390335,19.0254275%202.56386617,19.063197%202.53115242,19.0988848'%20fill='%23F9D320'%20mask='url(%23mask-2)'%3e%3c/path%3e%3cpath%20d='M50.9736803,68.1576208%20C49.8275093,69.89829%2047.6002974,71.7008178%2045.2692937,72.9026022%20L49.2541264,32.4853532%20C51.7894424,31.6707807%2054.2634944,30.5915242%2056.085948,29.0438662%20L50.9736803,68.1576208%20Z%20M41.3037918,74.5885502%20C37.4450558,75.8655762%2035.201487,76.2614126%2031.9895911,76.5766543%20L32.4901115,35.0432714%20C36.0383643,34.9415613%2040.6301859,34.4606691%2044.5427509,33.6255762%20L41.3037918,74.5885502%20Z%20M18.29829,74.5885502%20L15.0596283,33.6255762%20C18.9718959,34.4606691%2023.5637175,34.9415613%2027.1119703,35.0432714%20L27.6124907,76.5766543%20C24.4005948,76.2614126%2022.1573234,75.8655762%2018.29829,74.5885502%20Z%20M8.62869888,68.1576208%20L3.51613383,29.0438662%20C5.33858736,30.5915242%207.81263941,31.6707807%2010.3479554,32.4853532%20L14.3327881,72.9026022%20C12.0017844,71.7008178%209.77457249,69.89829%208.62869888,68.1576208%20Z%20M50.687881,13.6110037%20C50.7384387,13.8578439%2050.7666914,14.1130112%2050.7681784,14.3750186%20C50.7696654,14.64%2050.7440892,14.8990335%2050.6950186,15.1494424%20C52.5460223,15.4465428%2053.9663941,17.0411896%2053.9773978,18.9778439%20C53.9779926,19.0991822%2053.9714498,19.2193309%2053.9613383,19.3379926%20C54.904684,19.463197%2055.7421561,19.9253532%2056.3485502,20.5992565%20C53.6877323,24.6402974%2042.8237918,27.7159851%2029.8010409,27.790632%20C14.8895167,27.8759851%202.76193309,23.9952416%202.53115242,19.0985874%20C2.56386617,19.063197%202.59390335,19.0251301%202.62810409,18.9909294%20C2.39791822,18.5983643%202.23910781,18.1608922%202.15702602,17.6966543%20C0.729219331,19.0518959%20-0.13472119,20.1445353%200.0172490706,21.7356134%20C0.0318215613,21.9482528%206.3339777,67.0709294%206.3339777,67.0709294%20C7.06111524,74.2173978%2017.4388104,79.9292193%2029.8010409,80%20C42.1632714,79.9292193%2052.5412639,74.2173978%2053.2681041,67.0709294%20C53.2681041,67.0709294%2059.5702602,21.9482528%2059.5848327,21.7356134%20C59.8866914,18.5531599%2056.162974,15.6642379%2050.687881,13.6110037%20L50.687881,13.6110037%20Z'%20fill='%23DB382A'%20mask='url(%23mask-2)'%3e%3c/path%3e%3c/g%3e%3cpath%20d='M15.0596283,33.6255762%20L18.29829,74.5885502%20C22.1573234,75.8655762%2024.4005948,76.2614126%2027.6124907,76.5766543%20L27.1119703,35.0432714%20C23.5637175,34.9415613%2018.9718959,34.4606691%2015.0596283,33.6255762'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M31.9895911,76.5766543%20C35.201487,76.2614126%2037.4447584,75.8655762%2041.3037918,74.5885502%20L44.5424535,33.6255762%20C40.6301859,34.4606691%2036.0383643,34.9415613%2032.4901115,35.0432714%20L31.9895911,76.5766543'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M45.2692937,72.9026022%20C47.6002974,71.7008178%2049.8275093,69.89829%2050.9733829,68.1576208%20L56.085948,29.0438662%20C54.2634944,30.5915242%2051.7894424,31.6707807%2049.2541264,32.4853532%20L45.2692937,72.9026022'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M3.51613383,29.0438662%20L8.62840149,68.1576208%20C9.77457249,69.89829%2012.0017844,71.7008178%2014.3327881,72.9026022%20L10.3479554,32.4853532%20C7.81263941,31.6707807%205.33858736,30.5915242%203.51613383,29.0438662'%20fill='%23FFFFFE'%3e%3c/path%3e%3c/g%3e%3c/svg%3e", us = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20viewBox='0%200%2080%2080'%20preserveAspectRatio='xMidYMid'%20version='1.1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cg%20transform='translate(0,%2012.46)'%3e%3cg%3e%3cpath%20d='M45.4780328,39.6152131%20C45.9506885,38.4445902%2047.6259672,37.7314098%2048.8288525,37.8148197%20C50.114623,37.904%2051.4803934,39.2556066%2051.719082,40.584918%20C51.7634098,40.5366557%2051.8098361,40.4910164%2051.8570492,40.4461639%20C52.2699016,40.0516721%2052.7871475,39.7899016%2053.3531803,39.7177705%20C53.266623,39.3342951%2053.2459016,38.9238033%2053.3051803,38.5025574%20C53.5142295,37.0205902%2054.7034754,35.9092459%2056.0650492,35.9202623%20C56.9437377,35.9273443%2057.714623,36.376918%2058.216918,37.067541%20C58.2617705,37.0114098%2058.3113443,36.96%2058.3596066,36.907541%20C58.9340328,33.9152787%2059.2980984,30.5345574%2059.3809836,26.9468852%20C59.6655738,14.6103607%2056.5356066,4.53193443%2052.3902951,4.43645902%20C48.2447213,4.34072131%2044.653377,14.2638689%2044.3687869,26.6003934%20C44.3687869,26.6003934%2044.1492459,31.1000656%2045.4780328,39.6152131'%20id='Fill-1'%20fill='%23185A30'%3e%3c/path%3e%3cpath%20d='M73.5446557,53.1058361%20C73.7896393,52.696918%2073.9265574,52.2066885%2073.9171148,51.6857705%20C73.9965902,50.002623%2072.8411803,48.4768525%2071.2335738,48.6457705%20C71.28,48.4532459%2071.3104262,48.2531148%2071.3222295,48.0466885%20C71.4184918,46.3606557%2070.2557377,44.907541%2068.7249836,44.8013115%20C68.6914098,44.7992131%2068.6583607,44.7981639%2068.6250492,44.7971148%20C68.7842623,44.3787541%2068.8632131,43.9116066%2068.8351475,43.4166557%20C68.7559344,42.0139016%2067.7885902,40.832%2066.5300984,40.5993443%20C66.075541,40.5154098%2065.634623,40.5571148%2065.2309508,40.696918%20C64.8495738,39.757377%2064.0487869,39.060459%2063.074623,38.9133115%20C62.9975082,37.3878033%2061.8956066,36.1321967%2060.4768525,36.0338361%20C59.5847869,35.9719344%2058.7651148,36.3816393%2058.216918,37.067541%20C57.714623,36.376918%2056.9437377,35.9276066%2056.0650492,35.9204395%20C54.7034754,35.9092459%2053.5142295,37.0205902%2053.3051803,38.5028197%20C53.2459016,38.9238033%2053.266623,39.3342951%2053.3531803,39.7180328%20C52.7871475,39.7899016%2052.2699016,40.0519344%2051.8570492,40.4461639%20C51.8098361,40.4910164%2051.7634098,40.5366557%2051.719082,40.584918%20C51.4803934,39.2556066%2050.114623,37.9042623%2048.8288525,37.8148197%20C47.6259672,37.7314098%2045.928918,38.4621639%2045.4780328,39.6152131%20C45.6758033,41.6259672%2046.9327213,47.1071475%2051.4788197,52.0241311%20L51.5192131,52.0270164%20C51.9575082,52.4236066%2052.5298361,52.6420984%2053.1399344,52.5878033%20C53.5181639,52.5539672%2053.8664918,52.418623%2054.1665574,52.2098361%20L54.2397377,52.2148197%20C54.6397377,52.4925902%2055.1205246,52.6379016%2055.6285902,52.5927869%20C55.8226885,52.5754754%2056.0078689,52.5287869%2056.1838689,52.4621639%20C56.6192787,53.3623607%2057.5902951,53.9441311%2058.6740984,53.8486557%20C59.5134426,53.7746885%2060.2268852,53.3104262%2060.6462951,52.6570492%20L60.7821639,52.6664918%20C61.2010492,53.0817049%2061.7579016,53.323541%2062.3585574,53.3054426%20C62.855082,54.0566557%2063.767082,54.5188197%2064.7735082,54.4304262%20C65.1525246,54.3971148%2065.5063607,54.2874754%2065.8219016,54.1214426%20C66.3483279,54.7690492%2067.2123279,55.1540984%2068.1602623,55.0706885%20C69.0974426,54.9885902%2069.8890492,54.4689836%2070.3197377,53.7505574%20C70.7428197,54.0902295%2071.272918,54.2725246%2071.8358033,54.2224262%20C72.3819016,54.1736393%2072.8671475,53.9158033%2073.2317377,53.5257705%20L73.2925902,53.5299672%20C73.3754754,53.4098361%2073.4462951,53.2868197%2073.5121311,53.1627541%20C73.5137049,53.1603934%2073.5150164,53.1577705%2073.5163279,53.1554098%20C73.5252459,53.1388852%2073.5362623,53.122623%2073.5446557,53.1058361'%20fill='%23F9D320'%3e%3c/path%3e%3cpath%20d='M42.2090492,9.21232787%20L6.56209836,12.7268197%20C7.62203279,10.6709508%209.21206557,8.70662295%2010.7472787,7.6957377%20L45.2440656,3.18662295%20C43.8793443,4.79422951%2042.9272131,6.9762623%2042.2090492,9.21232787%20Z%20M45.2440656,49.5517377%20L10.7472787,45.042623%20C9.21206557,44.032%207.62203279,42.0674098%206.56209836,40.0118033%20L42.2090492,43.5262951%20C42.9272131,45.7620984%2043.8793443,47.9443934%2045.2440656,49.5517377%20Z%20M5.07514754,36.5143607%20C3.94885246,33.1108197%203.6,31.1323279%203.32170492,28.2992787%20L39.9527869,28.7409836%20C40.0427541,31.8701639%2040.4668852,35.9202623%2041.2031475,39.3707541%20L5.07514754,36.5143607%20Z%20M5.07514754,16.224%20L41.2031475,13.3676066%20C40.4668852,16.8180984%2040.0427541,20.8681967%2039.9527869,23.9976393%20L3.32170492,24.439082%20C3.6,21.6062951%203.94885246,19.627541%205.07514754,16.224%20Z%20M56.7186885,3.84865574%20C54.4333115,1.18767213%2052.7926557,-0.0616393443%2051.3872787,0.100721311%20C51.1252459,0.134032787%2011.4032787,5.67213115%2011.4032787,5.67213115%20C5.10006557,6.31318033%200.0624262295,15.4659672%200,26.3693115%20C0.0624262295,37.2723934%205.10006557,46.4251803%2011.4032787,47.0664918%20C11.4032787,47.0664918%2051.1997377,52.6247869%2051.3872787,52.6376393%20C51.7196066,52.635541%2052.0477377,52.5909508%2052.3711475,52.5080656%20C52.0563934,52.4144262%2051.7660328,52.2504918%2051.5192131,52.0270164%20L51.4788197,52.0241311%20C46.9327213,47.1074098%2045.6758033,41.6259672%2045.4780328,39.6152131%20C45.4785574,39.6136393%2045.4796066,39.6123279%2045.4801311,39.6107541%20C45.4796066,39.6123279%2045.4785574,39.6136393%2045.4780328,39.6152131%20C44.1492459,31.1000656%2044.3687869,26.6003934%2044.3687869,26.6003934%20C44.653377,14.2638689%2048.2447213,4.34072131%2052.3902951,4.43619672%20C56.5356066,4.53193443%2059.6655738,14.6103607%2059.3809836,26.9468852%20C59.2980984,30.5345574%2058.9340328,33.9152787%2058.3596066,36.907541%20C58.9497705,36.2562623%2059.741377,35.9819016%2060.4768525,36.0338361%20C60.6121967,36.043541%2060.7438689,36.0663607%2060.872918,36.096%20C63.3904262,22.3210492%2060.7512131,8.87029508%2056.7186885,3.84865574%20L56.7186885,3.84865574%20Z'%20fill='%23129B47'%3e%3c/path%3e%3c/g%3e%3cpath%20d='M41.2031475,13.3676066%20L5.07514754,16.224%20C3.94885246,19.627541%203.6,21.6062951%203.32170492,24.439082%20L39.9527869,23.997377%20C40.0427541,20.8681967%2040.4668852,16.8180984%2041.2031475,13.3676066'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M45.2440656,3.18662295%20L10.7472787,7.6957377%20C9.21206557,8.70662295%207.62203279,10.6709508%206.56209836,12.7268197%20L42.2090492,9.21232787%20C42.9272131,6.9762623%2043.8793443,4.79422951%2045.2440656,3.18662295'%20fill='%23FFFFFE'%3e%3c/path%3e%3cpath%20d='M6.56209836,40.011541%20C7.62203279,42.0674098%209.21206557,44.032%2010.7472787,45.042623%20L45.2440656,49.5517377%20C43.8793443,47.9443934%2042.9272131,45.7620984%2042.2090492,43.5262951%20L6.56209836,40.011541'%20fill='%23FFFFFE'%3e%3c/path%3e%3cg%20transform='translate(3.15,%2028)'%3e%3cpath%20d='M36.8052459,0.675409836%20L0.174163934,0.233704918%20C0.452459016,3.0664918%200.801311475,5.0452459%201.92760656,8.44878689%20L38.0556066,11.3051803%20C37.3193443,7.85468852%2036.8952131,3.80459016%2036.8052459,0.675409836'%20fill='%23FFFFFE'%3e%3c/path%3e%3c/g%3e%3c/g%3e%3c/svg%3e";
function gs(n) {
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
function ms(n) {
  const e = n ? gs(n) : [];
  return e.length ? a`<div
    class="movie-ratings"
    slot="collection"
    aria-label="Viewer and critic ratings"
  >
    ${e.map(({ kind: t, label: i, value: s, max: r }) => {
    const o = Math.round(s / r * 100), d = t === "critic" ? o >= 60 ? hs : cs : o >= 60 ? ps : us;
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
const fs = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20viewBox='0%200%20273.42%2035.52'%3e%3cdefs%3e%3cstyle%3e.cls-1{fill:url(%23linear-gradient);}%3c/style%3e%3clinearGradient%20id='linear-gradient'%20y1='17.76'%20x2='273.42'%20y2='17.76'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='0'%20stop-color='%2390cea1'/%3e%3cstop%20offset='0.56'%20stop-color='%233cbec9'/%3e%3cstop%20offset='1'%20stop-color='%2300b3e5'/%3e%3c/linearGradient%3e%3c/defs%3e%3ctitle%3eAsset%203%3c/title%3e%3cg%20id='Layer_2'%20data-name='Layer%202'%3e%3cg%20id='Layer_1-2'%20data-name='Layer%201'%3e%3cpath%20class='cls-1'%20d='M191.85,35.37h63.9A17.67,17.67,0,0,0,273.42,17.7h0A17.67,17.67,0,0,0,255.75,0h-63.9A17.67,17.67,0,0,0,174.18,17.7h0A17.67,17.67,0,0,0,191.85,35.37ZM10.1,35.42h7.8V6.92H28V0H0v6.9H10.1Zm28.1,0H46V8.25h.1L55.05,35.4h6L70.3,8.25h.1V35.4h7.8V0H66.45l-8.2,23.1h-.1L50,0H38.2ZM89.14.12h11.7a33.56,33.56,0,0,1,8.08,1,18.52,18.52,0,0,1,6.67,3.08,15.09,15.09,0,0,1,4.53,5.52,18.5,18.5,0,0,1,1.67,8.25,16.91,16.91,0,0,1-1.62,7.58,16.3,16.3,0,0,1-4.38,5.5,19.24,19.24,0,0,1-6.35,3.37,24.53,24.53,0,0,1-7.55,1.15H89.14Zm7.8,28.2h4a21.66,21.66,0,0,0,5-.55A10.58,10.58,0,0,0,110,26a8.73,8.73,0,0,0,2.68-3.35,11.9,11.9,0,0,0,1-5.08,9.87,9.87,0,0,0-1-4.52,9.17,9.17,0,0,0-2.63-3.18A11.61,11.61,0,0,0,106.22,8a17.06,17.06,0,0,0-4.68-.63h-4.6ZM133.09.12h13.2a32.87,32.87,0,0,1,4.63.33,12.66,12.66,0,0,1,4.17,1.3,7.94,7.94,0,0,1,3,2.72,8.34,8.34,0,0,1,1.15,4.65,7.48,7.48,0,0,1-1.67,5,9.13,9.13,0,0,1-4.43,2.82V17a10.28,10.28,0,0,1,3.18,1,8.51,8.51,0,0,1,2.45,1.85,7.79,7.79,0,0,1,1.57,2.62,9.16,9.16,0,0,1,.55,3.2,8.52,8.52,0,0,1-1.2,4.68,9.32,9.32,0,0,1-3.1,3A13.38,13.38,0,0,1,152.32,35a22.5,22.5,0,0,1-4.73.5h-14.5Zm7.8,14.15h5.65a7.65,7.65,0,0,0,1.78-.2,4.78,4.78,0,0,0,1.57-.65,3.43,3.43,0,0,0,1.13-1.2,3.63,3.63,0,0,0,.42-1.8A3.3,3.3,0,0,0,151,8.6a3.42,3.42,0,0,0-1.23-1.13A6.07,6.07,0,0,0,148,6.9a9.9,9.9,0,0,0-1.85-.18h-5.3Zm0,14.65h7a8.27,8.27,0,0,0,1.83-.2,4.67,4.67,0,0,0,1.67-.7,3.93,3.93,0,0,0,1.23-1.3,3.8,3.8,0,0,0,.47-1.95,3.16,3.16,0,0,0-.62-2,4,4,0,0,0-1.58-1.18,8.23,8.23,0,0,0-2-.55,15.12,15.12,0,0,0-2.05-.15h-5.9Z'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e";
function Ui() {
  return a`<a
      href="https://www.themoviedb.org"
      target="_blank"
      rel="noopener noreferrer"
      ><img src=${fs} alt="TMDB" width="100"
    /></a>
    <p class="muted">
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>`;
}
function bs(n, e, t = 8) {
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
                      ${r.map((o, d) => a`${d ? ", " : ""}${e(o)}`)}
                    </dd>
                  </div>` : l
  )}
          </dl>
        </details>` : l}
  ${n.enrichment && Object.keys(n.enrichment).length ? a`<details class="metadata-scores">
          <summary>Ratings and metadata sources</summary>
          ${Object.entries(n.enrichment).map(([s, r]) => a`<p class="muted">${s === "reviewed" ? "Reviewed metadata" : s === "tmdb" ? "TMDB" : "Kaleidescape store"}${r.critic_score != null ? a` · Rotten Tomatoes critics ${r.critic_score}%` : l}${r.audience_score != null ? a` · Rotten Tomatoes audience ${r.audience_score}%` : l}${r.audience_rating != null ? a` · TMDB audience ${r.audience_rating}/10 (${$(r.audience_votes ?? 0, "vote")})` : l}${r.distributor ? a` · Distributor: ${r.distributor}` : l}</p>`)}
          ${n.enrichment.tmdb || n.enrichment.reviewed?.providers?.includes("tmdb") ? Ui() : l}
        </details>` : l}`;
}
class ys {
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
          (h) => h.visible()
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
    this.cache = new ys(), this.active = 0, this.waiting = [];
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
const ve = class ve extends x {
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
      t === this.generation && u(o) === "unauthorized" && this.dispatchEvent(
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
ve.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  queue: { attribute: !1 },
  artworkKey: { attribute: !1 },
  fit: { type: String },
  title: { type: String }
}, ve.styles = S`
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
let nt = ve;
customElements.get("kaleidescape-library-cover") || customElements.define("kaleidescape-library-cover", nt);
const we = class we extends x {
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
      e.signal.aborted || (this.failed = !0, u(s) === "unauthorized" && this.dispatchEvent(
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
we.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  queue: { attribute: !1 },
  plan: {},
  choice: {}
}, we.styles = S`
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
let ot = we;
customElements.get("kaleidescape-scrape-image") || customElements.define("kaleidescape-scrape-image", ot);
function oi(n) {
  if (n)
    try {
      const e = new URL(n);
      return e.protocol === "https:" && !e.username && !e.password && !e.port && !e.search && !e.hash ? e.href : void 0;
    } catch {
      return;
    }
}
const $e = class $e extends x {
  constructor() {
    super(...arguments), this.versionId = "", this.blocked = !1, this.matchMode = "refresh", this.matchProvider = "", this.query = "", this.year = "", this.sourceExpected = {}, this.artworkExpected = {
      poster: !0,
      backdrop: !0
    }, this.fieldSources = {}, this.initialSources = {}, this.mappingTouched = !1, this.imageChoice = "", this.imagePage = 0, this.busy = !1, this.error = "", this.generation = 0, this.view = "sources", this.queue = new T();
  }
  get writePending() {
    return !!(this.pending || this.imagePending || this.resetPending);
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
    this.generation++, this.mainDialog()?.close(), this.choiceDialog()?.close(), this.options = this.review = void 0, this.candidatePage = void 0, this.query = this.year = this.matchProvider = this.imageChoice = "", this.sourceExpected = {}, this.artworkExpected = { poster: !0, backdrop: !0 }, this.fieldSources = {}, this.initialSources = {}, this.mappingTouched = !1, this.imageKind = void 0, this.imagePage = 0, this.pending = void 0, this.imagePending = void 0, this.resetPending = void 0, this.busy = !1, this.error = "", this.view = "sources", this.queue.cache.dispose(), this.queue = new T(), this.lock();
  }
  close() {
    this.pending || this.imagePending || this.resetPending || this.busy || (this.candidatePage && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.candidatePage.search_id).catch(() => {
    }), this.review && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.review.plan_id).catch(() => {
    }), this.reset(), this.requestUpdate());
  }
  closeChoice(e = !1) {
    !e && (this.imagePending || this.busy) || (this.candidatePage && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.candidatePage.search_id).catch(() => {
    }), this.review && this.client && this.scope && this.client.cancelTitleScrape(this.scope, this.review.plan_id).catch(() => {
    }), this.choiceDialog()?.close(), this.candidatePage = void 0, this.imageKind = void 0, this.imageChoice = "", this.requestUpdate());
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
    this.error = w(e), u(e) === "unauthorized" && this.dispatchEvent(
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
    if (!this.client || !this.scope || !this.options || !this.sourceExpected[e] || this.changedExpectations() || this.mappingTouched || this.busy || this.writePending || !this.query.trim() || !this.validYear())
      return;
    this.busy = !0, this.error = "", this.requestUpdate();
    const t = this.generation;
    try {
      const i = await this.client.titleScrapeRefresh(
        this.scope,
        this.versionId,
        e,
        this.query,
        this.year.trim() ? Number(this.year) : void 0
      );
      if (t !== this.generation) return;
      i.outcome === "matches" ? (this.candidatePage = i, this.matchMode = "refresh", this.matchProvider = e, this.requestUpdate(), await this.updateComplete, this.choiceDialog()?.showModal()) : (await this.loadOptions(), this.emitChange());
    } catch (i) {
      t === this.generation && this.report(i);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async useMatch(e) {
    if (!this.client || !this.scope || !this.candidatePage || this.busy) return;
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      if (this.matchMode === "refresh") {
        if (await this.client.titleScrapeRefreshChoice(
          this.scope,
          this.versionId,
          this.matchProvider,
          this.candidatePage.search_id,
          e
        ), t !== this.generation) return;
        this.closeChoice(!0), await this.loadOptions(), this.emitChange();
      } else {
        const i = await this.client.titleScrapePreview(
          this.scope,
          this.versionId,
          "tmdb",
          this.candidatePage.search_id,
          e
        );
        if (t !== this.generation) return;
        if ("search_id" in i) throw new b("refresh_required");
        this.review = i, this.candidatePage = void 0, this.imageChoice = "", this.requestUpdate();
      }
    } catch (i) {
      t === this.generation && this.report(i);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async editImage(e) {
    if (!this.client || !this.scope || this.busy || this.writePending || this.mappingTouched || this.changedExpectations())
      return;
    this.busy = !0, this.error = "", this.imageKind = e, this.requestUpdate();
    const t = this.generation;
    try {
      const i = await this.client.titleScrapePreview(
        this.scope,
        this.versionId,
        "tmdb"
      );
      if (t !== this.generation) return;
      this.imageChoice = "", this.imagePage = 0, "search_id" in i ? (this.candidatePage = i, this.matchMode = "image", this.matchProvider = "tmdb") : this.review = i, this.requestUpdate(), await this.updateComplete, this.choiceDialog()?.showModal();
    } catch (i) {
      t === this.generation && (this.imageKind = void 0, this.report(i));
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async useImage() {
    if (!this.client || !this.scope || !this.review || !this.imageKind || !this.imageChoice || this.busy)
      return;
    this.busy = !0, this.error = "", this.requestUpdate();
    const e = this.generation;
    try {
      if (this.imagePending ??= this.client.prepareTitleScrape(this.scope, {
        plan_id: this.review.plan_id,
        fields: [],
        images: { [this.imageKind]: this.imageChoice },
        save_match: !0
      }), this.lock(), await this.client.applyTitleScrape(this.imagePending), e !== this.generation) return;
      this.imagePending = void 0, this.lock(), this.closeChoice(!0), this.review = void 0, await this.loadOptions(), this.emitChange();
    } catch (t) {
      e === this.generation && (this.report(t), ["invalid_request", "refresh_required", "not_found"].includes(
        u(t)
      ) && (this.imagePending = void 0, this.lock()));
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async resetCover() {
    if (!this.client || !this.scope || !this.options?.snapshot || this.busy || this.pending || this.imagePending || this.mappingTouched || this.changedExpectations())
      return;
    this.busy = !0, this.error = "";
    const e = this.generation;
    try {
      if (this.resetPending ??= this.client.prepareMetadataAction(this.scope, {
        action: "reset_cover",
        title_id: this.versionId,
        snapshot: this.options.snapshot
      }), this.lock(), await this.client.applyTitleScrape(this.resetPending), e !== this.generation) return;
      this.resetPending = void 0, this.lock(), await this.loadOptions(), this.emitChange();
    } catch (t) {
      e === this.generation && (this.report(t), ["invalid_request", "refresh_required", "not_found"].includes(
        u(t)
      ) && (this.resetPending = void 0, this.lock()));
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async save() {
    if (!this.client || !this.scope || !this.options?.snapshot || this.busy || this.resetPending || this.imagePending || !this.changedExpectations() && !this.mappingTouched && !this.pending)
      return;
    this.busy = !0, this.error = "", this.requestUpdate();
    const e = this.generation;
    try {
      if (this.changedExpectations()) {
        if (this.pending ??= this.client.prepareScrapeExpectations(this.scope, {
          title_id: this.versionId,
          snapshot: this.options.snapshot,
          providers: this.sourceExpected,
          artwork: this.artworkExpected
        }), this.lock(), await this.client.applyTitleScrape(this.pending), e !== this.generation) return;
        this.pending = void 0, this.lock(), await this.loadOptions();
      }
      if (this.mappingTouched) {
        const t = Object.fromEntries(
          (this.options.field_mapping ?? []).filter(
            (i) => i.override || this.fieldSources[i.field] !== this.initialSources[i.field]
          ).map((i) => [i.field, this.fieldSources[i.field]])
        );
        if (this.pending ??= this.client.prepareMetadataAction(this.scope, {
          action: "mapping",
          title_id: this.versionId,
          snapshot: this.options.snapshot,
          sources: t
        }), this.lock(), await this.client.applyTitleScrape(this.pending), e !== this.generation) return;
        this.pending = void 0, this.lock();
      }
      this.emitChange(), this.reset(), this.requestUpdate();
    } catch (t) {
      e === this.generation && (this.report(t), ["invalid_request", "refresh_required", "metadata_disabled"].includes(
        u(t)
      ) && (this.pending = void 0, this.lock()));
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
      i(s.target.checked), this.requestUpdate();
    }} /><span aria-hidden="true"></span
    ></label>`;
  }
  currentMovie() {
    const e = this.options?.current;
    if (!e) return l;
    const t = this.options?.artwork_present?.poster ?? !!e.artwork_key, i = this.options?.artwork_present?.backdrop ?? !!e.backdrop_key, s = this.options?.providers.every(
      (o) => !this.sourceExpected[o.id] || o.has_data
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
            <kaleidescape-library-cover
              .client=${this.client}
              .scope=${this.scope}
              .queue=${this.queue}
              .artworkKey=${e.artwork_key}
              .title=${e.title}
            ></kaleidescape-library-cover>
            <div class="image-links">
              ${r && this.options?.artwork_enabled ? a`<button class="text-link" ?disabled=${this.busy || this.writePending || this.mappingTouched || this.changedExpectations()} @click=${() => {
      this.editImage("poster");
    }}>Edit</button>` : l}
              ${e.original_artwork_key ? a`<button class="text-link" ?disabled=${this.busy || !!this.pending || !!this.imagePending || this.mappingTouched || this.changedExpectations()} @click=${() => {
      this.resetCover();
    }}>${this.resetPending ? "Retry reset" : "Reset"}</button>` : l}
            </div>
          </div>
          <div>
            <h2 class="movie-title">${e.title}</h2>
            <p>
              ${e.year ?? "Year unavailable"} ·
              ${e.duration_seconds ? `${Math.round(e.duration_seconds / 60)} min` : "Runtime unavailable"}
            </p>
            <dl class="current-meta">
              <dt>Director</dt>
              <dd>${e.directors.join(", ") || "Unavailable"}</dd>
              <dt>Top cast</dt>
              <dd>${e.actors.join(", ") || "Unavailable"}</dd>
              <dt>Metadata updated</dt>
              <dd>
                ${e.metadata_synced_at ? new Date(e.metadata_synced_at).toLocaleDateString() : "Unavailable"}
              </dd>
            </dl>
          </div>
        </div>
        <div class="current-backdrop">
          <kaleidescape-library-cover
            .client=${this.client}
            .scope=${this.scope}
            .queue=${this.queue}
            .artworkKey=${e.backdrop_key}
            .title=${`${e.title} backdrop`}
            .fit=${"contain"}
          ></kaleidescape-library-cover>
          ${r && this.options?.artwork_enabled ? a`<div class="image-links"><button class="text-link" ?disabled=${this.busy || this.writePending || this.mappingTouched || this.changedExpectations()} @click=${() => {
      this.editImage("backdrop");
    }}>Edit</button></div>` : l}
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
      this.artworkExpected.poster = !o.target.checked, this.requestUpdate();
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
      this.artworkExpected.backdrop = !o.target.checked, this.requestUpdate();
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
        match is downloaded automatically. Save changed switches or field
        choices before refreshing.
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
                ${oi(e.match_url) ? a`<a href=${oi(e.match_url)} target="_blank" rel="noopener noreferrer" aria-label=${`View ${e.label} match`}>View match</a>` : l}
              </div>
              <span class="source-detail">
                ${e.has_data ? e.fetched_at ? `Downloaded - Updated ${new Date(e.fetched_at).toLocaleDateString()}` : "Downloaded - Update date unavailable" : e.checked_at ? `No data available - Last Checked ${new Date(e.checked_at).toLocaleDateString()}` : "Not yet scanned"}
                <br /><small
                  >${e.has_data ? `${e.fields ?? 0} fields saved · ` : ""}${this.sourceExpected[e.id] ? e.available ? "Included" : "Needs configuration" : "Excluded from completeness"}</small
                >
              </span>
              <button
                ?disabled=${!e.available || !this.sourceExpected[e.id] || this.busy || this.writePending || this.mappingTouched || this.changedExpectations() || !this.query.trim() || !this.validYear()}
                @click=${() => {
        this.refresh(e.id);
      }}
              >
                Refresh
              </button>
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
        const i = e.values[t], s = i != null && i !== "" && (!Array.isArray(i) || i.length > 0);
        return a`<td>
                      <label
                        ><input
                          type="radio"
                          name=${`field-${e.field}`}
                          aria-label=${`Use ${t === "original" ? "Raw Library" : this.options.providers.find((r) => r.id === t)?.label} for ${e.label}`}
                          .checked=${this.fieldSources[e.field] === t}
                          ?disabled=${this.busy || this.writePending || !s || !(t in e.values)}
                          @change=${() => {
          this.fieldSources = {
            ...this.fieldSources,
            [e.field]: t
          }, this.mappingTouched = !0, this.requestUpdate();
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
          ${k(() => this.closeChoice(), this.busy)}
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
        ${k(() => this.closeChoice(), this.busy || !!this.imagePending)}
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
                ?disabled=${!!this.imagePending}
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
        ${this.imagePending ? a`<button
                ?disabled=${this.busy}
                @click=${() => {
      window.confirm(
        "Inspect the Library before discarding an unconfirmed image save. Discard retry?"
      ) && (this.imagePending = void 0, this.lock(), this.requestUpdate());
    }}
              >
                Discard retry
              </button>` : l}
        <button
          class="primary"
          ?disabled=${!this.imageChoice || this.busy}
          @click=${() => {
      this.useImage();
    }}
        >
          ${this.imagePending ? "Retry exact image save" : "Use image"}
        </button>
      </div>
    </div>`;
  }
  render() {
    return this.scope?.permissions.edit ? a`${It("Scrape title", "scrape", this.blocked || this.writePending, () => {
      this.open();
    }, "scrape-button")}
      <dialog
        data-admin-dialog
        class="inset-dialog"
        aria-labelledby="scrape-title"
        @click=${C}
        @cancel=${(e) => {
      e.preventDefault(), this.close();
    }}
      >
        <div class="card-head manager-head">
          <div>
            <h2 id="scrape-title">Movie Metadata Manager</h2>
            <p>Search, scrape and reconcile metadata.</p>
          </div>
          ${k(() => this.close(), this.busy || this.writePending)}
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
        <div class="dialog-footer manager-actions">
          ${this.pending || this.resetPending ? a`<button
                  @click=${() => {
      window.confirm(
        "Inspect the Library before discarding an unconfirmed save. Discard retry?"
      ) && (this.pending = void 0, this.resetPending = void 0, this.lock(), this.requestUpdate());
    }}
                >
                  Discard retry
                </button>` : l}
          <button
            class="primary"
            ?disabled=${this.busy || !!this.resetPending || !!this.imagePending || !this.pending && !this.changedExpectations() && !this.mappingTouched}
            @click=${() => {
      this.save();
    }}
          >
            ${this.pending ? "Retry exact save" : "Save"}
          </button>
        </div>
      </dialog>
      <dialog
        data-admin-dialog
        class="choice-dialog"
        aria-labelledby="choice-title"
        @click=${C}
        @cancel=${(e) => {
      e.preventDefault(), this.busy || this.closeChoice();
    }}
      >
        ${this.choiceContent()}
      </dialog>` : l;
  }
};
$e.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  versionId: {},
  blocked: { type: Boolean }
}, $e.styles = [
  q,
  Nt,
  S`
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
          880px,
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
      .movie-title {
        font-size: 20px;
        line-height: 1.2;
        margin: 0 0 6px;
        overflow-wrap: anywhere;
      }
      .current-meta {
        margin: 6px 0 0;
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
        .source-row button {
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
let lt = $e;
customElements.get("kaleidescape-title-scrape") || customElements.define("kaleidescape-title-scrape", lt);
function li(n) {
  return n.toLocaleLowerCase().normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").match(/[\p{L}\p{N}_]+/gu)?.join(" ") ?? "";
}
function vs(n, e) {
  const t = Math.min(2, Math.max(1, Math.ceil(n.length / 4)));
  if (n.length < 3 || Math.max(n.length, e.length) > 100 || Math.abs(n.length - e.length) > t)
    return !1;
  let i = Array.from({ length: e.length + 1 }, (r, o) => o), s = i;
  for (let r = 1; r <= n.length; r++) {
    const o = Array(e.length + 1).fill(t + 1);
    o[0] = r;
    for (let d = Math.max(1, r - t); d <= Math.min(e.length, r + t); d++) {
      let h = Math.min(
        i[d] + 1,
        o[d - 1] + 1,
        i[d - 1] + +(n[r - 1] !== e[d - 1])
      );
      r > 1 && d > 1 && n[r - 1] === e[d - 2] && n[r - 2] === e[d - 1] && (h = Math.min(h, s[d - 2] + 1)), o[d] = h;
    }
    if (Math.min(...o) > t) return !1;
    s = i, i = o;
  }
  return i[e.length] <= t;
}
function dt(n, e, t = !1) {
  const i = e.trim();
  if (i.length >= 2 && i.startsWith('"') && i.endsWith('"')) {
    let h;
    try {
      h = JSON.parse(i).trim();
    } catch {
      h = i.slice(1, -1).trim();
    }
    if (!h) return !1;
    const c = h.toLocaleLowerCase().split(/\s+/).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(
      "(?<![\\p{L}\\p{N}_])" + c.join("\\s+") + "(?![\\p{L}\\p{N}_])",
      "u"
    ).test(n.toLocaleLowerCase());
  }
  if (n.toLocaleLowerCase().includes(e.toLocaleLowerCase()))
    return !0;
  if (!t) return !1;
  const s = li(e), r = li(n);
  if (!s) return !1;
  if (r.includes(s)) return !0;
  const o = s.split(" "), d = r.split(" ");
  return o.length <= 12 && o.every(
    (h) => d.some((c) => c.includes(h) || vs(h, c))
  );
}
const N = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, Ti = (n) => (...e) => ({ _$litDirective$: n, values: e });
let Ai = class {
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
const { I: ws } = ss, di = (n) => n, $s = (n) => n.strings === void 0, hi = () => document.createComment(""), se = (n, e, t) => {
  const i = n._$AA.parentNode, s = e === void 0 ? n._$AB : e._$AA;
  if (t === void 0) {
    const r = i.insertBefore(hi(), s), o = i.insertBefore(hi(), s);
    t = new ws(r, o, n, n.options);
  } else {
    const r = t._$AB.nextSibling, o = t._$AM, d = o !== n;
    if (d) {
      let h;
      t._$AQ?.(n), t._$AM = n, t._$AP !== void 0 && (h = n._$AU) !== o._$AU && t._$AP(h);
    }
    if (r !== s || d) {
      let h = t._$AA;
      for (; h !== r; ) {
        const c = di(h).nextSibling;
        di(i).insertBefore(h, s), h = c;
      }
    }
  }
  return t;
}, O = (n, e, t = n) => (n._$AI(e, t), n), xs = {}, Pi = (n, e = xs) => n._$AH = e, ks = (n) => n._$AH, Ze = (n) => {
  n._$AR(), n._$AA.remove();
};
const ci = Ti(class extends Ai {
  constructor(n) {
    if (super(n), n.type !== N.PROPERTY && n.type !== N.ATTRIBUTE && n.type !== N.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!$s(n)) throw Error("`live` bindings can only contain a single expression");
  }
  render(n) {
    return n;
  }
  update(n, [e]) {
    if (e === z || e === l) return e;
    const t = n.element, i = n.name;
    if (n.type === N.PROPERTY) {
      if (e === t[i]) return z;
    } else if (n.type === N.BOOLEAN_ATTRIBUTE) {
      if (!!e === t.hasAttribute(i)) return z;
    } else if (n.type === N.ATTRIBUTE && t.getAttribute(i) === e + "") return z;
    return Pi(n), e;
  }
}), We = S`
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
  .collection-new {
    --badge-color: #27c4f2;
    --badge-tint: #086f95;
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
  .movie-record-details {
    margin-top: 12px;
    font-size: 12px;
  }
  .version-format-badges {
    margin-top: 10px;
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
    .movie-description,
    .movie-record-details {
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
`, _s = S`
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
function pi(n, e, t, i) {
  const s = (r, o, d, h = "") => a` <button
      type="button"
      class=${h}
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
const Cs = {
  state_observed: "The requested playback state was observed.",
  acknowledged: "The player accepted the command; its final state is not confirmed.",
  unconfirmed: "The command may have executed. An administrator must inspect the player before more commands can be sent. Nothing will be replayed automatically.",
  rejected: "The player rejected the command. Nothing was retried.",
  not_sent: "Settings or access changed before sending. The command was not sent."
}, xe = class xe extends x {
  constructor() {
    super(...arguments), this.mode = "remote", this.versionId = "", this.playerId = "", this.inlineRemote = !1, this.value = "", this.configured = !0, this.generation = 0, this.key = "", this.waking = !1, this.wakeDeadline = 0, this.started = "", this.lastOperation = "", this.selectedPlayer = "", this.dialog = "players", this.acknowledge = "", this.busy = !1, this.error = "", this.notice = "", this.locked = !1;
  }
  willUpdate(e) {
    if (!["scope", "client", "versionId", "playerId"].some(
      (i) => e.has(i)
    ))
      return;
    const t = this.scope?.permissions.read ? `${this.scope.entry_id}:${this.scope.dataset_id}:${!!this.scope.permissions.edit}:${this.versionId}:${this.playerId}` : "";
    (t !== this.key || this.client !== this.boundClient) && ((this.client !== this.boundClient || !this.key || !t || this.key.split(":").slice(0, 3).join(":") !== t.split(":").slice(0, 3).join(":")) && (this.selectedPlayer = ""), this.generation++, this.key = t, this.boundClient = this.client, this.info = this.status = this.pending = void 0, this.stopWaking(), this.busy = !1, this.acknowledge = this.error = this.notice = this.started = this.lastOperation = "", this.playerId && (this.selectedPlayer = this.playerId), t && this.client && this.load(!0));
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
    super.disconnectedCallback(), this.generation++, this.stopWaking(), this.pending = this.info = void 0;
  }
  fail(e) {
    const t = u(e), i = {
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
    this.error = i[t] ?? w(e), t === "unauthorized" && (this.generation++, this.info = this.pending = this.status = void 0, this.selectedPlayer = "", this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async load(e = !1) {
    const t = this.generation;
    try {
      const i = await this.client.controlInfo(this.scope);
      if (t !== this.generation) return;
      this.info = i, i.players.some((s) => s.id === this.selectedPlayer) || (this.selectedPlayer = i.default_player || i.players[0]?.id || ""), e && i.enabled && this.selectedPlayer && this.mode !== "settings" && await this.readStatus();
    } catch (i) {
      t === this.generation && this.fail(i);
    }
    t === this.generation && this.requestUpdate();
  }
  async action(e) {
    if (this.busy || !this.client || !this.scope?.permissions.read) return;
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
    this.scope?.permissions.edit && await this.action(async () => {
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
    this.notice = Cs[t.outcome], this.pending = void 0;
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
      return a`<slot name="collection"></slot>`;
    const t = e?.devices?.filter((o) => o.is_player) ?? [], i = e?.players.find(
      (o) => o.id === this.selectedPlayer
    ), s = e?.blocked_players.includes(this.selectedPlayer), r = this.busy || this.waking || !e?.enabled || !this.selectedPlayer || !!this.pending || s;
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
                  ?disabled=${this.busy || !e?.enabled || !this.configured}
                  @click=${this.discover}
                >
                  ${this.busy ? "Discovering…" : "Discover devices"}
                </button>
              </div>
              ${!e?.enabled || !this.configured ? a`<p class="muted">Save the enabled control hostname before discovering devices.</p>` : l}
              <label
                >Default player<select
                  name="control_player"
                  .value=${this.value}
                  ?disabled=${this.busy}
                  @change=${(o) => this.dispatchEvent(new CustomEvent("player-selected", { detail: o.target.value, bubbles: !0, composed: !0 }))}
                >
                  <option value="" ?selected=${!this.value}>
                    No default player selected
                  </option>
                  ${this.value && !t.some((o) => o.serial === this.value) ? a`<option value=${this.value} selected>Configured player (${this.value})</option>` : l}
                  ${t.map((o) => a`<option value=${o.serial} ?selected=${o.serial === this.value}>${o.name || o.model || "Movie player"} (${o.serial})</option>`)}
                </select></label
              >
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
                    ${L(this.status?.ready && !this.waking ? "play" : "power")}
                    ${this.waking ? a`<span class="spinner" aria-hidden="true">◌</span> Starting player…` : !this.status || this.status.readiness === "starting" ? "Check player" : this.status.ready ? "Play" : "Power On"}</button
                  ><button
                    type="button"
                    ?disabled=${this.busy || this.waking || !!this.pending}
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
      ${this.mode === "remote" && this.inlineRemote && e?.enabled ? pi(i?.name || "Kaleidescape player", !!r, !!this.status?.ready, (o) => {
      this.prepare(o);
    }) : l}
      ${this.dialog !== "remote" || this.acknowledge ? this.feedback() : l}
      ${s && !(e?.can_manage && this.scope.permissions.edit) ? a`<p class="warning">This player needs administrator review of an uncertain command before more commands can be sent.</p>` : l}
      ${e?.can_manage && this.scope.permissions.edit ? e.pending.map((o) => a`<p class="warning">Unconfirmed ${o.operation} for ${e.players.find((d) => d.id === o.player_id)?.name || "a previously selected player"}. <button type="button" ?disabled=${this.busy} @click=${() => this.reviewPending(o.request_id)}>I inspected the player…</button></p>`) : l}
      <dialog
        ?data-admin-dialog=${!!this.acknowledge}
        class=${this.dialog === "remote" && !this.acknowledge ? "database-dialog remote-dialog" : "database-dialog"}
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.acknowledge ? "Review unconfirmed command" : this.dialog === "remote" ? "Theater Remote" : "Choose Player"}
          </h2>
          ${k((o) => this.close(o))}
        </div>
        ${this.acknowledge ? a`<p>
                Confirm you inspected the physical player. This permits new
                commands and does not resend the earlier command.
              </p>` : this.dialog === "remote" ? a`${pi(
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
xe.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  mode: {},
  versionId: {},
  playerId: {},
  inlineRemote: { type: Boolean },
  value: {},
  configured: { type: Boolean }
}, xe.styles = [
  q,
  _s,
  S`
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
let ht = xe;
customElements.get("kaleidescape-device-controls") || customElements.define("kaleidescape-device-controls", ht);
const ui = [
  "close",
  "cancel",
  "control-lock",
  "edit-lock",
  "scrape-lock",
  "collection-lock"
];
class Ss {
  constructor(e, t) {
    this.host = e, this.change = t, this.profile = G(), this.schedule = () => {
      this.frame !== void 0 || G() === this.profile || (this.frame = requestAnimationFrame(() => {
        this.frame = void 0;
        const i = G();
        this.host.isConnected && i !== this.profile && this.change() && (this.profile = i);
      }));
    };
  }
  hostConnected() {
    window.addEventListener("resize", this.schedule);
    for (const e of ui)
      this.host.renderRoot.addEventListener(e, this.schedule, !0);
  }
  hostUpdated() {
    this.schedule();
  }
  hostDisconnected() {
    window.removeEventListener("resize", this.schedule);
    for (const e of ui)
      this.host.renderRoot.removeEventListener(e, this.schedule, !0);
    this.frame !== void 0 && cancelAnimationFrame(this.frame), this.frame = void 0;
  }
}
function ue(n, e) {
  n.addController(new Ss(n, e));
}
class j {
  constructor(e, t, i, s, r = "library") {
    this.client = e, this.scope = t, this.shared = i, this.error = s, this.area = r, this.values = {}, this.revision = 0, this.profile = G(), this.active = !0, this.inflight = 0, this.sequence = 0, this.versions = /* @__PURE__ */ new Map(), this.failed = {};
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
function qs(n) {
  const e = n.watched_status === "in_progress" ? { key: "progress", label: "In progress", symbol: "◔" } : n.watched_status === "watched" ? { key: "watched", label: "Watched", symbol: "✓" } : n.is_recently_added ? { key: "recent", label: "Recently added", symbol: "NEW" } : void 0;
  return [
    ...e ? [e] : [],
    ...n.is_favorite ? [{ key: "favorite", label: "Favorite", symbol: "★" }] : []
  ];
}
function Ht(n) {
  const e = (n.formats?.length ? n.formats : [n.edition ?? ""]).map(
    (s) => s.toLowerCase()
  ), t = (s) => e.some((r) => s.test(r)), i = [];
  return e.some(
    (s) => /\b4k\b/.test(s) && !/\bcinematic\b/.test(s)
  ) && i.push({ key: "four-k", label: "4K" }), e.some((s) => /\b4k\b/.test(s) && /\bcinematic\b/.test(s)) && i.push({ key: "cinematic", label: "4K Cinematic" }), t(/\bhd\b|\b1080p\b/) && i.push({ key: "hd", label: "HD" }), t(/\bsd\b|\b(?:480|576)[pi]\b/) && i.push({ key: "sd", label: "SD" }), t(/\bsdr\b/) && i.push({ key: "sdr", label: "SDR" }), t(/\bhdr10\b/) && i.push({ key: "hdr10", label: "HDR10" }), t(/\bdolby\s*vision\b/) && i.push({ key: "vision", label: "Dolby Vision" }), t(/\bdolby\s*atmos\b/) && i.push({ key: "atmos", label: "Dolby Atmos" }), i;
}
function Es(n) {
  const e = Ht(n);
  return ["cinematic", "four-k", "hd", "sd"].map((t) => e.find((i) => i.key === t)).find(Boolean);
}
function K(n, e = !1, t, i = !1) {
  const s = e ? Es(n) : void 0;
  return (e ? s ? [s] : [] : Ht(n)).map((r) => {
    const o = r.key === "cinematic" ? a`<b>4K</b><span class="cinematic-label">Cinematic</span>` : r.label;
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
function Ge(n, e = !1, t = []) {
  return qs(n).filter((i) => !t.includes(i.key)).map(
    (i) => a`<span
          class=${e ? `cover-flag flag-${i.key}` : `status-badge collection-badge collection-${Je(i.label)}`}
          title=${i.label}
          aria-label=${i.label}
          role="img"
          >${e ? a`<span class="badge-symbol" aria-hidden="true">${i.symbol}</span>` : a`${Wt(i.label)}<span>${i.label}</span>`}</span
        >`
  );
}
function oe(n, e, t = !1) {
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
function B(n) {
  return n.toLocaleLowerCase() === "played" ? "Watched" : n;
}
function Je(n) {
  const e = n.toLowerCase();
  return {
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
function Wt(n) {
  const e = Je(n), t = {
    all: _`<path d="m2 7 10-5 10 5-10 5zM2 12l10 5 10-5M2 17l10 5 10-5"/>`,
    new: _`<path d="m12 1 3 2 4 1 1 4 3 4-3 3-1 4-4 1-3 3-3-3-4-1-1-4-3-3 3-4 1-4 4-1z"/><text x="12" y="14.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="6" font-weight="800">NEW</text>`,
    unwatched: _`<circle cx="12" cy="12" r="10"/><path fill="currentColor" stroke="none" d="m9 6 9 6-9 6z"/>`,
    watched: _`<circle cx="12" cy="12" r="10"/><path d="m6 12 4 4 8-8"/>`,
    favorite: _`<path d="M12 21 3 12C-3 4 6-1 12 6c6-7 15-2 9 6z"/>`,
    progress: _`<circle cx="12" cy="12" r="10"/><path d="M9 7v10M15 7v10"/>`
  };
  return _`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t[e]}</svg>`;
}
function Qe(n, e, t = !1) {
  const i = a`${Wt(n)}<span
      >${B(n)}</span
    >`, s = `collection-badge collection-${Je(n)}`;
  return e ? a`<button
        type="button"
        class=${s}
        aria-label=${`Filter by collection: ${B(n)}`}
        ?disabled=${t}
        @click=${e}
      >
        ${i}
      </button>` : a`<span class=${s}>${i}</span>`;
}
const ke = class ke extends x {
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
    e?.preventDefault(), this.clear(), this.requestUpdate();
  }
  fail(e) {
    this.error = w(e), ["unauthorized", "library_disabled"].includes(u(e)) && (this.clear(), this.dispatchEvent(
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
    return !this.scope?.permissions.edit || !this.version || !this.enabled ? l : a`${It("Collection", "collection", this.blocked || this.busy, () => this.open(), "collection-button")}
      ${this.notice ? a`<p role="status">${this.notice}</p>` : l}
      <dialog
        data-admin-dialog
        class="database-dialog"
        @click=${C}
        @cancel=${this.close}
        aria-labelledby="collection-add-title"
      >
        <div class="card-head">
          <h2 id="collection-add-title">Add to Collection</h2>
          ${k((e) => this.close(e))}
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
        ${this.loading ? a`<p role="status">Reading available collections from the device…</p>` : l}
        ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
        ${this.pending ? a`<p class="warning">
                  ${this.busy ? "Waiting for the device and read-back verification…" : "The result is unconfirmed. Check its status without sending another add."}
                </p>
                <button ?disabled=${this.busy} @click=${this.check}>
                  Check add result
                </button>` : a`<label
                  >Collection<select
                    name="add_collection"
                    ?disabled=${this.loading}
                    .value=${this.selected}
                    @change=${(e) => {
      this.selected = e.target.value, this.requestUpdate();
    }}
                  >
                    <option value="">Choose a collection</option>
                    ${this.choices.map((e) => a`<option value=${e}>${e}</option>`)}
                  </select></label
                >
                ${!this.loading && !this.choices.length && !this.error ? a`<p>No offered, visible collection targets are available. Sync or check the server’s collections.</p>` : l} `}
        ${this.pending ? l : a`<div class="dialog-footer"><button class="primary" ?disabled=${this.loading || !this.selected} @click=${this.submit}>Add selected version</button></div>`}
      </dialog>`;
  }
};
ke.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  version: { attribute: !1 },
  revision: { type: Number },
  enabled: { type: Boolean },
  blocked: { type: Boolean }
}, ke.styles = [
  q,
  Nt,
  S`
      .collection-button {
        border-radius: 999px;
        padding: 9px;
        min-height: 44px;
        line-height: 20px;
      }
      @media (max-width: 600px) {
        .collection-button {
          padding-inline: 9px;
          font-size: 13px;
        }
      }
    `
];
let ct = ke;
customElements.get("kaleidescape-library-collection-add") || customElements.define(
  "kaleidescape-library-collection-add",
  ct
);
const gi = [
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
], Xe = /* @__PURE__ */ new Set([
  "actors",
  "directors",
  "writers",
  "producers",
  "studios",
  "genres"
]), _e = class _e extends x {
  constructor() {
    super(...arguments), this.versionId = "", this.blocked = !1, this.draft = {}, this.busy = !1, this.opened = !1, this.restoring = !1, this.error = "", this.generation = 0;
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
    this.generation++, this.review = void 0, this.draft = {}, this.pending = void 0, this.busy = !1, this.opened = this.restoring = !1, this.error = "", this.renderRoot.querySelector("dialog")?.close(), this.lock();
  }
  close() {
    this.reset(), this.requestUpdate();
  }
  confirmNavigation() {
    return this.busy || this.pending ? !1 : !this.opened || !this.review || !this.restoring && !Object.keys(this.patch()).length || window.confirm("Discard your unsaved Library changes?");
  }
  report(e) {
    this.error = w(e), u(e) === "unauthorized" && (this.reset(), this.dispatchEvent(
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
      this.review = t, this.draft = Object.fromEntries(
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
  patch() {
    const e = {};
    for (const [t] of gi) {
      const i = Xe.has(t) ? this.draft[t].split(`
`).map((s) => s.trim()).filter(Boolean) : t === "year" ? this.draft[t].trim() ? Number(this.draft[t]) : null : t === "sort_title" ? this.draft[t].trim() || null : this.draft[t];
      JSON.stringify(i) !== JSON.stringify(
        this.review.values[t] ?? (Xe.has(t) ? [] : t === "sort_title" || t === "year" ? null : "")
      ) && (e[t] = i);
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
      this.pending = void 0, this.busy = !1, this.close(), this.dispatchEvent(
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
      ].includes(u(t)) && (this.pending = void 0), this.report(t);
    } finally {
      e === this.generation && (this.busy = !1, this.lock(), this.requestUpdate());
    }
  }
  render() {
    return this.scope?.permissions.edit ? a`${It("Edit details", "edit", this.blocked || this.busy || !!this.pending, () => this.open())}
      <dialog
        data-admin-dialog
        class="inset-dialog"
        aria-labelledby="library-edit-title"
        @click=${C}
        @cancel=${(e) => {
      e.preventDefault(), this.close();
    }}
      >
        <div class="card-head">
          <h2 id="library-edit-title">Edit Library details</h2>
          ${k(() => this.close())}
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
                    Applies to ${$(this.review.version_count, "version")}.
                    Changes survive scans. Source IDs, runtime, formats,
                    purchases and viewing records are protected. Enter one name
                    per line for credits and genres.
                  </p>
                  <div class="edit-fields">
                    ${gi.map(
      ([e, t]) => a`<label
                          >${t}${Xe.has(e) || e === "synopsis" ? a`<textarea
                                  name=${e}
                                  .value=${this.draft[e] ?? ""}
                                  ?disabled=${!!this.pending || this.busy}
                                  @input=${(i) => {
        this.draft[e] = i.target.value, this.requestUpdate();
      }}
                                ></textarea>` : a`<input
                                  name=${e}
                                  type=${e === "year" ? "number" : "text"}
                                  .value=${this.draft[e] ?? ""}
                                  ?disabled=${!!this.pending || this.busy}
                                  @input=${(i) => {
        this.draft[e] = i.target.value, this.requestUpdate();
      }}
                                />`}</label
                        >`
    )}
                  </div>` : l}
        <div class="dialog-footer">
          <button ?disabled=${this.busy || !!this.pending} @click=${this.close}>
            Cancel
          </button>
          ${this.review && !this.restoring && !this.pending ? a`<button
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
_e.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  versionId: {},
  blocked: { type: Boolean }
}, _e.styles = [
  q,
  Nt,
  S`
      :host {
        display: inline-block;
      }
      dialog {
        width: min(640px, calc(100% - 24px));
      }
      .edit-fields {
        display: grid;
        gap: 16px;
        padding-block: 8px 16px;
      }
      textarea {
        min-height: 90px;
      }
    `
];
let pt = _e;
customElements.get("kaleidescape-title-edit") || customElements.define("kaleidescape-title-edit", pt);
const H = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["rating", "Rating", "rating"],
  ["genre", "Genre", "genres"],
  ["year", "Year", "year"],
  ["format", "Viewing format", "format"]
], et = [
  ["name", "Title"],
  ["year", "Year"],
  ["collection", "Collection"],
  ["length", "Length"],
  ["watched", "Status"],
  ["added", "Added on"],
  ["random", "Random"]
], mi = [
  ["show_titles", "Show titles on covers"],
  ["show_format", "Show format"],
  ["show_badges", "Show library badges"],
  ["show_rating", "Show rating on covers"],
  ["show_library_cost", "Show total library cost in footer"]
], W = {
  watched: "Watched",
  unwatched: "Unwatched",
  in_progress: "In progress",
  unknown: "Unknown"
}, Ce = class Ce extends x {
  constructor() {
    super(), this.bound = "", this.generation = 0, this.listRequest = 0, this.statusRequest = 0, this.purchaseLoading = !1, this.purchaseError = "", this.purchaseDetailsOpen = !1, this.versionRequest = 0, this.versionsLoading = !1, this.versionsError = "", this.widths = [360, 90, 260, 150, 140, 210], this.collectionLocked = !1, this.controlLocked = !1, this.scrapeLocked = !1, this.artworkLocked = !1, this.editLocked = !1, this.castLimit = 8, this.checkingCollection = !1, this.filters = {
      query: "",
      sort: "name",
      descending: !1
    }, this.applied = { ...this.filters }, this.loading = !1, this.requesting = !1, this.error = "", this.notice = "", this.covers = new T(), this.fuzzySearch = !0, this.mode = "list", this.coverSize = 150, this.display = {
      show_titles: !0,
      show_format: !0,
      show_badges: !0,
      show_rating: !1,
      show_library_cost: !1
    }, this.entriesPerPage = 100, this.preferencesReady = !1, this.preferenceError = "", this.peopleTimers = {}, this.peopleSearch = {}, this.peopleChoices = {}, this.peopleRequests = {}, this.coverColumns = 1, this.gridWidth = 0, this.requestLimit = 50, this.requestedOffset = 0, this.draft = {}, this.facetSearch = "", this.visibility = () => {
      clearTimeout(this.timer), document.hidden ? (clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0) : (this.refreshStatus(), this.scheduleLayoutPage());
    }, this.mobileQuery = "", ue(this, () => !this.preferencesReady || this.preferences?.unsettled || this.searchPreferences?.unsettled || this.loading || this.detailsLocked || this.resize || this.renderRoot.querySelector("dialog[open]") ? !1 : (this.clear(), this.initializePreferences(), this.refreshStatus(), !0));
  }
  get detailsLocked() {
    return this.collectionLocked || this.controlLocked || this.scrapeLocked || this.artworkLocked || this.editLocked;
  }
  confirmNavigation() {
    return this.controlLocked || this.collectionLocked || this.scrapeLocked || this.artworkLocked || this.checkingCollection ? !1 : this.renderRoot.querySelector("kaleidescape-title-edit")?.confirmNavigation() ?? !0;
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  willUpdate(e) {
    if (!this.isConnected) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if (this.boundClient !== this.client || this.bound !== t) {
      this.clear(), this.boundClient = this.client, this.bound = t, this.client && this.scope?.library_enabled && (this.initializePreferences(), this.refreshStatus());
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
    this.preferences = new j(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t && u(t) === "unauthorized" ? this.fail(t) : (this.preferenceError = t ? w(t) : "", this.requestUpdate()));
      }
    ), this.searchPreferences = new j(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t && u(t) === "unauthorized" ? this.fail(t) : (this.preferenceError = t ? w(t) : "", this.requestUpdate()));
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
          [...H.map(([r]) => r), "status"].map((r) => [
            r,
            []
          ])
        ),
        missing_metadata_artwork: !1
      } : t;
      this.dashboard && (this.preferences?.dispose(), this.preferences = void 0, this.searchPreferences?.dispose(), this.searchPreferences = void 0, this.coverColumns = this.dashboard.columns), this.fuzzySearch = i.fuzzy_search, this.mode = s.view, this.entriesPerPage = s.page_size, this.coverSize = s.cover_size, this.castLimit = Number.isInteger(s.cast_limit) ? s.cast_limit : 8, this.display = Object.fromEntries(
        mi.map(([r]) => [r, s[r]])
      ), this.scope?.permissions.edit && this.display.show_library_cost && this.loadPurchaseTotals(), this.widths = [...s.widths], this.applied = Object.fromEntries(
        [
          "query",
          "sort",
          "random_seed",
          "descending",
          ...H.map(([r]) => r),
          "status",
          "missing_metadata_artwork"
        ].map((r) => [r, s[r]])
      ), this.filters = structuredClone(this.applied), this.preferencesReady = !0, this.openCriterion ? this.fromDetails(this.openCriterion.key, this.openCriterion.value) : await this.load(), this.openTitleId && e === this.generation && this.openLinkedTitle(this.openTitleId);
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  saveFilters() {
    this.preferences?.set(
      Object.fromEntries(
        [
          "query",
          ...H.map(([e]) => e),
          "status",
          "missing_metadata_artwork"
        ].map((e) => [
          e,
          this.applied[e] ?? (e === "query" ? "" : e === "missing_metadata_artwork" ? !1 : [])
        ])
      )
    );
  }
  finishColumnResize() {
    this.resize && (this.resize = void 0, this.preferences?.set({ widths: [...this.widths] }));
  }
  clear() {
    this.mobileQuery = "", this.purchaseTotals = void 0, this.purchaseLoading = !1, this.purchaseError = "", this.purchaseDetailsOpen = !1;
    const e = this.renderRoot.querySelector(".purchase-details");
    e && (e.open = !1), clearTimeout(this.searchTimer), this.clearPeople(), this.preferences?.dispose(), this.preferences = void 0, this.searchPreferences?.dispose(), this.searchPreferences = void 0, this.preferencesReady = !1, this.preferenceError = "", this.generation++, this.listRequest++, clearTimeout(this.timer), clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0, this.gridObserver?.disconnect(), this.gridObserver = void 0, this.grid = void 0, this.gridWidth = 0, this.coverColumns = 1, this.entriesPerPage = this.requestLimit = 100, this.requestedOffset = 0;
    for (const t of this.renderRoot.querySelectorAll("dialog"))
      t.close();
    this.covers.cache.dispose(), this.covers = new T(), this.fuzzySearch = !0, this.castLimit = 8, this.display = {
      show_titles: !0,
      show_format: !0,
      show_badges: !0,
      show_rating: !1,
      show_library_cost: !1
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
    const t = u(e);
    (t === "unauthorized" || t === "library_disabled") && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        t === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    )), this.error = w(e), this.requestUpdate();
  }
  async load(e = 0, t = !1) {
    if (this.detailsLocked || !this.client || !this.scope?.library_enabled) return;
    clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0;
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
      i = u(s) === "unauthorized", e === this.generation && t === this.statusRequest && this.fail(s);
    } finally {
      e === this.generation && t === this.statusRequest && this.isConnected && !i && !document.hidden && (this.timer = setTimeout(
        () => {
          this.refreshStatus();
        },
        this.info?.metadata?.running || this.info?.metadata?.active || this.info?.phase && this.info.phase !== "idle" ? 5e3 : 3e4
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
    e === "library-search" && (this.mobileQuery = String(this.filters.query ?? "")), e === "filter-dialog" && this.clearPeople(), this.renderRoot.querySelector(`#${e}`)?.close(), e === "title-dialog" && (this.selected = void 0, this.clearVersions()), this.requestUpdate();
  }
  async openLinkedTitle(e) {
    if (!this.client || !this.scope?.library_enabled) return;
    const t = this.generation, i = ++this.versionRequest;
    try {
      const s = await this.client.libraryVersions(this.scope, e);
      if (t !== this.generation || i !== this.versionRequest)
        return;
      const r = s.items[0];
      if (!r) return;
      this.selected = r, this.versions = s, this.activeVersion = r, this.requestUpdate(), await this.openDialog("title-dialog");
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
      t === this.generation && i === this.versionRequest && (["unauthorized", "library_disabled"].includes(u(o)) ? this.fail(o) : u(o) === "refresh_required" && e ? this.loadVersions() : this.versionsError = w(o));
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
        i = Q().replaceAll("-", "");
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
    this.clearPeople(), this.draft = structuredClone(this.applied), this.facetSearch = "", this.openDialog("filter-dialog");
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
    this.detailsLocked || this.checkingCollection || (clearTimeout(this.searchTimer), this.clearPeople(), this.filters = {
      query: e === "query" ? t : "",
      sort: this.applied.sort,
      descending: this.applied.descending,
      random_seed: this.applied.random_seed,
      ...e === "query" ? {} : { [e]: [t] }
    }, this.applied = structuredClone(this.filters), this.draft = {}, this.facetSearch = "", this.saveFilters(), this.closeDialog("title-dialog"), this.load(), this.updateComplete.then(
      () => this.renderRoot.querySelector('[name="library_query"]')?.focus()
    ));
  }
  detailLink(e, t, i = t) {
    return a`<button
      type="button"
      class="link detail-link"
      ?disabled=${this.detailsLocked || this.checkingCollection}
      @click=${() => this.fromDetails(e, e === "query" ? JSON.stringify(t) : t)}
    >
      ${i}
    </button>`;
  }
  clearPeople() {
    for (const e of Object.values(this.peopleTimers)) clearTimeout(e);
    this.peopleTimers = {}, this.peopleSearch = {}, this.peopleChoices = {};
    for (const e of ["actor", "director"])
      this.peopleRequests[e] = (this.peopleRequests[e] ?? 0) + 1;
  }
  completePeople(e, t) {
    this.peopleSearch[e] = t, delete this.peopleChoices[e], clearTimeout(this.peopleTimers[e]);
    const i = (this.peopleRequests[e] ?? 0) + 1;
    this.peopleRequests[e] = i;
    const s = this.generation;
    this.peopleTimers[e] = setTimeout(async () => {
      try {
        const r = await this.client.librarySuggestions(
          this.scope,
          e,
          t,
          this.fuzzySearch
        );
        s === this.generation && this.peopleRequests[e] === i && this.renderRoot.querySelector("#filter-dialog")?.open && (this.peopleChoices[e] = r.items, this.requestUpdate());
      } catch (r) {
        s === this.generation && this.peopleRequests[e] === i && this.fail(r);
      }
    }, 200), this.requestUpdate();
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
      @click=${C}
    >
      <div class="card-head">
        <h2 id="library-search-title">Search Library</h2>
        ${k(() => this.closeDialog("library-search"))}
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
            .value=${ci(this.mobileQuery)}
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
    clearTimeout(this.searchTimer), this.applied = { ...this.applied, query: this.filters.query }, this.preferences?.set({ query: this.applied.query }), this.load();
  }
  choices(e, t) {
    const i = e === "status" ? Object.keys(W) : this.page?.facets[t] ?? [];
    return [
      .../* @__PURE__ */ new Set([...i, ...this.draft[e] ?? []])
    ].filter(
      (s) => dt(
        e === "collection" ? B(s) : s,
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
  async loadPurchaseTotals(e = !1) {
    if (!this.client || !this.scope?.library_enabled || !this.scope.permissions.edit || this.purchaseLoading || !e && this.purchaseTotals && this.purchaseTotals.revision === this.info?.revision)
      return;
    const t = this.generation;
    this.purchaseLoading = !0, this.purchaseError = "", this.requestUpdate();
    try {
      const i = await this.client.libraryPurchaseTotals(this.scope);
      t === this.generation && (this.purchaseTotals = i);
    } catch (i) {
      if (t !== this.generation) return;
      this.purchaseTotals = void 0, this.purchaseError = w(i), ["unauthorized", "library_disabled"].includes(u(i)) && this.fail(i);
    } finally {
      t === this.generation && (this.purchaseLoading = !1, this.requestUpdate());
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
      this.purchaseDetailsOpen = t.target.open, this.purchaseDetailsOpen && this.loadPurchaseTotals();
    }}
    >
      <summary>Purchase details</summary>
      <p class="muted">
        Recorded purchases for this Library source, including unavailable
        titles. Filters do not change these totals. Currencies are kept
        separate.
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
                ${$(e.purchase_count, "purchase record")}. Missing
                prices are excluded. Savings use records with both prices in the
                same currency.
              </p>
              ${e.missing_purchase_prices || e.missing_retail_prices ? a`<p class="muted">${$(e.missing_purchase_prices, "missing paid price")} · ${$(e.missing_retail_prices, "missing retail price")}.</p>` : l}
              ${e.unpaired_prices ? a`<p class="muted">${$(e.unpaired_prices, "purchase record")} excluded from savings because prices are missing or use different currencies.</p>` : l}
              ${e.missing_order_ids ? a`<p class="muted">${$(e.missing_order_ids, "purchase record")} without an order ID; not included in the transaction count.</p>` : l}
              ${e.duplicate_purchases ? a`<p class="muted">${$(e.duplicate_purchases, "duplicate purchase record")} counted only once.</p>` : l}` : l}
    </details>`;
  }
  renderOptionsDialog() {
    return a`<dialog
      id="library-options"
      class="database-dialog library-options"
      aria-labelledby="library-options-title"
      @click=${C}
    >
      <div class="card-head">
        <h2 id="library-options-title">Library options</h2>
        ${k(() => this.closeDialog("library-options"))}
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
            ${et.map(([e, t]) => a`<option value=${e} ?selected=${e === this.applied.sort}>${t}</option>`)}
          </select></label
        >
        <label class="check"
          ><input
            type="checkbox"
            name="library_fuzzy_search"
            .checked=${this.fuzzySearch}
            @change=${(e) => {
      this.fuzzySearch = e.target.checked, this.clearPeople(), clearTimeout(this.searchTimer), this.applied = { ...this.applied, query: this.filters.query }, this.searchPreferences?.set({ fuzzy_search: this.fuzzySearch }), this.preferences?.set({ query: this.applied.query }), this.load();
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
        ${mi.filter(
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
                ${$(this.info.group_count, "movie")} ·
                ${$(this.info.title_count, "individual version")} ·
                ${$(this.info.collection_count, "collection")}.
              </p>
              <p>
                Catalog synced: ${this.date(this.info.last_synced_at)}<br />Collections
                synced: ${this.date(this.info.collections_synced_at)}
              </p>
              <p>
                Source “Played” maps to Watched; “Paused” maps to In progress.
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
      @click=${C}
      class="database-dialog library-dialog"
      aria-labelledby="filters-title"
    >
      <div class="card-head">
        <h2 id="filters-title">Library filters</h2>
        ${k(() => this.closeDialog("filter-dialog"))}
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
      <div class="facet-groups">
        ${[
      ["status", "Watched status", "status"],
      ...H.filter(([e]) => e !== "actor" && e !== "director")
    ].map(([e, t, i]) => {
      const s = this.draft[e] ?? [], r = this.choices(e, i);
      return a`<fieldset>
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
          this.draft = {
            ...this.draft,
            [e]: d.target.checked ? [...s, o] : s.filter((h) => h !== o)
          }, this.requestUpdate();
        }}
                          />${e === "status" ? Qe(W[o]) : e === "rating" ? oe(o) : e === "collection" ? Qe(o) : o}</label
                        >`
      ) : a`<p class="muted">No matching options</p>`}
            </div>
          </fieldset>`;
    })}
      </div>
      <div class="people-filters">
        ${[
      ["actor", "Actor", "actors"],
      ["director", "Director", "directors"]
    ].map(([e, t, i]) => {
      const s = this.draft[e] ?? [], r = (this.peopleChoices[e] ?? (this.page?.facets[i] ?? []).filter(
        (o) => dt(o, this.peopleSearch[e] ?? "", this.fuzzySearch)
      )).slice(0, 20);
      return a`<fieldset>
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
        (o) => a`<button
                    type="button"
                    class="person-chip"
                    aria-label=${`Remove ${o}`}
                    @click=${() => {
          this.draft = {
            ...this.draft,
            [e]: s.filter((d) => d !== o)
          }, this.requestUpdate();
        }}
                  >
                    ${o} ×
                  </button>`
      )}
            </div>
            <div class="facet-options" aria-label=${`${t} suggestions`}>
              ${r.map(
        (o) => a`<label class="check"
                    ><input
                      type="checkbox"
                      name=${e}
                      value=${o}
                      .checked=${s.includes(o)}
                      ?disabled=${s.length >= 100 && !s.includes(o)}
                      @change=${(d) => {
          this.draft = {
            ...this.draft,
            [e]: d.target.checked ? [...s, o] : s.filter((h) => h !== o)
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
        ><span class="grow"></span>
        <button
          class="primary"
          @click=${() => {
      const e = { ...this.applied };
      for (const t of [...H.map(([i]) => i), "status"])
        e[t] = this.draft[t] ?? [];
      e.missing_metadata_artwork = !!this.draft.missing_metadata_artwork, this.applied = e, this.saveFilters(), this.closeDialog("filter-dialog"), this.load();
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
      .blocked=${this.controlLocked || this.scrapeLocked || this.artworkLocked || !!this.info?.pending_adds?.length}
      @collection-lock=${(t) => {
      t.detail !== this.collectionLocked && (this.collectionLocked = t.detail, this.requestUpdate());
    }}
      @collection-changed=${(t) => {
      this.collectionLocked = !1, this.notice = t.detail.status === "confirmed" ? "Collection membership confirmed on the device." : "Check the pending collection add before making another change.", this.load(), this.refreshStatus();
    }}
    ></kaleidescape-library-collection-add>` : l;
  }
  compactRuntime(e) {
    if (e == null) return "Runtime unknown";
    const t = Math.round(e / 60), i = Math.floor(t / 60);
    return i ? `${i}h ${t % 60}m` : `${t}m`;
  }
  conflictIcon(e) {
    return this.scope?.permissions.edit && e.scraper_conflict ? a`<span
          class="scraper-conflict-icon"
          role="img"
          aria-label="Scraper conflict"
          title="Scraper conflict: review a provider match"
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
    ></kaleidescape-title-scrape>`;
  }
  renderTitleDialog() {
    const e = this.selected, t = this.activeVersion, i = (this.versions?.total ?? e?.version_count ?? 1) > 1, s = this.scope?.permissions.edit, r = this.detailsLocked || this.checkingCollection, o = e?.content_ratings ?? [
      ...new Set(
        [
          e?.rating,
          ...(this.versions?.items ?? []).map((h) => h.rating)
        ].filter((h) => !!h?.trim())
      )
    ], d = t && "backdrop_key" in t ? t.backdrop_key : t?.enrichment?.tmdb?.backdrop_key;
    return a`<dialog
      id="title-dialog"
      @cancel=${(h) => {
      h.preventDefault(), this.closeDialog("title-dialog");
    }}
      @click=${C}
      class=${`database-dialog library-dialog movie-dialog inset-dialog${d ? " has-backdrop" : ""}`}
      aria-labelledby="library-title"
      @close=${() => {
      this.selected = void 0, this.clearVersions(), this.controlLocked = !1, this.requestUpdate();
    }}
    >
      ${e ? a`
              <div class="movie-close">
                ${k(() => this.closeDialog("title-dialog"))}
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
                  ${t?.genres.length ? a` · ${t.genres.map((h, c) => a`${c ? ", " : ""}${this.detailLink("genre", h)}`)}` : l}
                </p>
                <div class="detail-badges movie-heading-badges">
                  ${K(i ? e : t ?? e, !1, (h) => this.fromDetails("format", h), r)}
                  ${o.map((h) => oe(h, (c) => this.fromDetails("rating", c), r))}
                  <button
                    class=${`movie-status collection-badge collection-${Je(W[t?.watched_status ?? e.watched_status])}`}
                    ?disabled=${r}
                    @click=${() => this.fromDetails("status", t?.watched_status ?? e.watched_status)}
                  >
                    ${Wt(W[t?.watched_status ?? e.watched_status])}
                    <span
                      >${W[t?.watched_status ?? e.watched_status]}</span
                    >
                  </button>
                  ${Ge(e, !1, ["watched", "progress"])}
                  ${e.collections.map(
      (h) => Qe(
        h,
        () => this.fromDetails("collection", h),
        r
      )
    )}
                </div>
                ${t ? a`<kaleidescape-device-controls
                        .client=${this.client}
                        .scope=${this.scope}
                        .versionId=${t.id}
                        mode="movie"
                        @control-lock=${(h) => {
      h.detail !== this.controlLocked && (this.controlLocked = h.detail, this.requestUpdate());
    }}
                        >${this.renderCollectionAction(t)}${s ? a`<kaleidescape-title-edit
                                  slot="collection"
                                  .client=${this.client}
                                  .scope=${this.scope}
                                  .versionId=${t.id}
                                  .blocked=${this.controlLocked || this.collectionLocked || this.scrapeLocked || this.artworkLocked}
                                  @edit-lock=${(h) => {
      h.detail !== this.editLocked && (this.editLocked = h.detail, this.requestUpdate());
    }}
                                  @metadata-changed=${async () => {
      this.editLocked = !1, this.versions = void 0, await this.load(
        this.page?.offset ?? 0,
        !0
      ), await this.loadVersions(), this.refreshStatus();
    }}
                                ></kaleidescape-title-edit>
                                ${this.renderScrapeAction(t)}` : l}${ms(t)}</kaleidescape-device-controls
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
      (h, c) => a`<button
                                ?disabled=${this.detailsLocked}
                                role="tab"
                                id=${`version-${c}`}
                                aria-controls="version-details"
                                tabindex=${h.id === t?.id ? 0 : -1}
                                aria-selected=${h.id === t?.id}
                                @click=${() => {
        this.activeVersion = h, this.requestUpdate();
      }}
                              >
                                Version ${this.versions.offset + c + 1}
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
                      aria-labelledby=${(this.versions?.total ?? 1) > 1 ? `version-${this.versions?.items.findIndex((h) => h.id === t.id) ?? 0}` : l}
                    >
                      <div class="movie-aside">
                        <div class="cover movie-poster">${this.cover(t)}</div>
                        ${i ? a`<div class="detail-badges version-format-badges">${K(t, !1, (h) => this.fromDetails("format", h), r)}</div>` : l}
                        <details class="movie-record-details">
                          <summary>Library details</summary>
                          <p class="muted">
                            ${t.purchased_on ? a`Purchased ${this.date(t.purchased_on)}<br />` : l}First
                            detected ${this.date(t.first_seen)}.
                          </p>
                          ${s && t.purchase_history?.length ? a`<details>
                                  <summary>
                                    Purchase history · Administrator
                                  </summary>
                                  ${t.purchase_history.map((h) => a`<p>${this.date(h.purchased_on)} · ${h.title}<br />Paid: ${h.purchase_price ?? "Unknown"} · Retail: ${h.retail_price ?? "Unknown"}<br />Order: ${h.order_id ?? "Unknown"}${h.href ? a`<br />Store reference: ${h.href}` : l}</p>`)}
                                </details>` : l}
                        </details>
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
      ["Collections", t.collections, "collection"]
    ].map(
      ([h, c, m]) => c.length ? a`<div>
                                  <dt>${h}</dt>
                                  <dd>
                                    ${c.map((p, y) => a`${y ? ", " : ""}${this.detailLink(m, p, h === "Collections" ? B(p) : p)}`)}
                                  </dd>
                                </div>` : l
    )}
                        </dl>
                        ${bs(t, (h) => this.detailLink("query", h), this.castLimit)}
                        <p>
                          <button
                            class="link"
                            ?disabled=${this.detailsLocked}
                            @click=${() => this.dispatchEvent(new CustomEvent("open-title-journal", { detail: { id: t.id, title: t.title }, bubbles: !0, composed: !0 }))}
                          >
                            View journal entries for this movie
                          </button>
                        </p>
                      </div>
                    </div>` : l}
            ` : l}
    </dialog>`;
  }
  render() {
    if (!this.preferencesReady)
      return a`<p role="status">
          ${this.error || "Loading Library preferences…"}
        </p>
        ${this.error ? a`<button @click=${this.initializePreferences}>Retry Library</button>` : l}`;
    const e = this.page?.limit ?? this.requestLimit, t = this.loading || !!this.layoutTimer, i = this.page?.items ?? [], s = this.mode === "covers" && !this.dashboard && this.page?.has_more && i.length >= this.coverColumns ? i.slice(
      0,
      i.length - i.length % this.coverColumns
    ) : i, r = this.scope?.permissions.edit, o = [...H.map(([d]) => d), "status"].reduce(
      (d, h) => d + (this.applied[h]?.length ?? 0),
      +!!this.applied.missing_metadata_artwork
    );
    return a`<section
      class="library-page"
      @access-denied=${(d) => {
      d.stopPropagation(), this.fail(new b("unauthorized"));
    }}
    >
      ${this.preferenceError ? a`<p class="warning" role="alert">
              Library preferences could not be saved: ${this.preferenceError}
              <button
                @click=${() => {
      this.preferences?.retry(), this.searchPreferences?.retry();
    }}
              >
                Retry saving preferences
              </button>
            </p>` : l}
      ${r && this.info?.phase && this.info.phase !== "idle" ? a`<p role="status">Syncing… ${this.info.processed ?? 0}/${this.info.total ?? "?"}</p>` : l}
      ${r && this.info?.error ? a`<p class="warning" role="status">${w(new b(this.info.error))}</p>` : l}
      ${this.error ? a`<p class="error" role="alert">${this.error}<button @click=${() => this.load()}>Refresh results</button></p>` : l}
      ${this.notice ? a`<p class="notice" role="status">${this.notice}</p>` : l}
      ${r ? (this.info?.pending_adds ?? []).map(
      (d) => a`<div class="warning" role="status">
                  Unconfirmed collection add: <strong>${d.title}</strong> →
                  ${d.collection}. Checking never sends another add.
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
                      Acknowledge unconfirmed add
                    </button>
                  </div>
                </div>`
    ) : l}
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
              ${L("search")}
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
              ${L("filter")}
            </button>
            <button
              type="button"
              aria-label="Clear search and filters"
              title="Clear search and filters"
              ?hidden=${this.dashboard?.show_filters === !1}
              ?disabled=${this.loading}
              @click=${this.clearFilters}
            >
              ${L("clear")}
            </button>
            <button
              type="button"
              aria-label=${this.applied.sort === "random" ? "Randomize Library" : this.applied.descending ? "Sort ascending" : "Sort descending"}
              title=${this.applied.sort === "random" ? "Randomize" : this.applied.descending ? "Sort ascending" : "Sort descending"}
              ?hidden=${this.dashboard?.show_sort === !1}
              @click=${() => this.sort(String(this.applied.sort))}
            >
              ${L(this.applied.sort === "random" ? "shuffle" : this.applied.descending ? "descending" : "ascending")}
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
              ${L("options")}
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
                .value=${ci(String(this.filters.query ?? ""))}
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
                ${et.map(([d, h]) => a`<option value=${d}>${h}</option>`)}
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
                      title=${`${d.title}${d.year ? ` (${d.year})` : ""}`}
                      aria-label=${`Details for ${d.title}${d.year ? ` (${d.year})` : ""}`}
                      @click=${() => this.select(d)}
                    >
                      <div class="cover-image">${this.cover(d)}</div>
                      ${this.display.show_badges ? a`<div class="cover-flags">${Ge(d, !0)}</div>` : l}
                      ${this.display.show_format ? a`<div class="cover-formats">${K(d, !0)}</div>` : l}
                      ${this.display.show_rating ? a`<div class="cover-rating">${oe(d.rating)}</div>` : l}
                      ${this.conflictIcon(d)}
                      ${this.display.show_titles ? a`<span class="cover-caption">${d.title}${d.year ? ` (${d.year})` : ""}</span>` : l}
                    </button>`
    )}
              </div>` : a`<div class="table-wrap">
                <table
                  class="library-table"
                  style=${`--library-width: ${this.widths.reduce((d, h) => d + h, 0)}px`}
                >
                  <colgroup>
                    ${this.widths.map((d) => a`<col style=${`width: ${d}px`} />`)}
                  </colgroup>
                  <thead>
                    <tr>
                      ${et.filter(([d]) => d !== "random").map(
      ([d, h], c) => a`<th
                            aria-sort=${this.applied.sort === d ? this.applied.descending ? "descending" : "ascending" : "none"}
                          >
                            <button
                              class="sort-heading"
                              @click=${() => this.sort(d)}
                            >
                              <span>${h}</span
                              ><span class="sort-icon" aria-hidden="true"
                                >${this.applied.sort === d ? this.applied.descending ? "↓" : "↑" : "↕"}</span
                              >
                            </button>
                            <span
                              class="column-resize"
                              role="separator"
                              aria-label=${`Resize ${h} column`}
                              aria-orientation="vertical"
                              aria-valuemin="80"
                              aria-valuemax="800"
                              aria-valuenow=${this.widths[c]}
                              tabindex="0"
                              title="Drag or use Left/Right to resize; Home resets"
                              @keydown=${(m) => this.resizeColumn(m, c)}
                              @pointerdown=${(m) => {
        m.preventDefault(), this.resize = {
          index: c,
          start: m.clientX,
          width: this.widths[c]
        }, m.currentTarget.setPointerCapture(m.pointerId);
      }}
                              @pointermove=${(m) => {
        this.resize?.index === c && (this.widths[c] = Math.max(
          80,
          Math.min(
            800,
            this.resize.width + m.clientX - this.resize.start
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
                              class="library-summary-line"
                              title=${this.format(d)}
                            >
                              ${this.display.show_badges ? Ge(d) : l}
                              ${this.display.show_format ? K(d) : l}
                              ${this.display.show_format && !Ht(d).length ? a`<small>${this.format(d)}</small>` : l}
                              ${(d.version_count ?? 1) > 1 ? a`<small>${$(d.version_count, "version")}</small>` : l}
                            </div>
                          </td>
                          <td title=${this.years(d)}>${this.years(d)}</td>
                          <td>
                            <span
                              class="collection-cell"
                              title=${d.collections.map(B).join(", ")}
                              >${d.collections.map(B).join(", ") || "—"}</span
                            >
                          </td>
                          <td>${this.runtime(d)}</td>
                          <td>${W[d.watched_status]}</td>
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
            Total ${this.info?.group_count ?? 0} · Unwatched
            ${this.info?.status_counts?.unwatched ?? 0} · Watched
            ${this.info?.status_counts?.watched ?? 0} · Paused
            ${this.info?.status_counts?.in_progress ?? 0}
          </span>
          ${r && this.info ? a`<span class="footer-admin">${$(this.info.collection_count, "collection")}${this.info.artwork_enabled ? ` · Artwork ${((this.info.artwork_bytes ?? 0) / 1048576).toFixed(1)} MiB` : ""}${this.display.show_library_cost ? ` · Library cost ${this.purchaseAmount("library_cost")}` : ""} · Synced ${this.date(this.info.last_synced_at)}</span>` : l}
          ${r && this.info?.metadata ? a`<span class="scraper-status footer-admin">${this.scraperSummary()}</span>` : l}
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
                    ><span class="paging-icon">${L("first")}</span>
                  </button>
                  <button
                    aria-label="Previous page"
                    ?disabled=${t || !this.page.offset}
                    @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - e))}
                  >
                    <span class="paging-label">Previous</span
                    ><span class="paging-icon">${L("previous")}</span>
                  </button>
                  <button
                    aria-label="Next page"
                    ?disabled=${t || !this.page.has_more}
                    @click=${() => this.load((this.page?.offset ?? 0) + e)}
                  >
                    <span class="paging-label">Next</span
                    ><span class="paging-icon">${L("next")}</span>
                  </button>` : l}
        </div>
      </footer>
      ${this.renderOptionsDialog()} ${this.renderFilterDialog()}
      ${this.renderSearchDialog()} ${this.renderTitleDialog()}
    </section>`;
  }
};
Ce.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  openTitleId: { attribute: !1 },
  openCriterion: { attribute: !1 },
  dashboard: { attribute: !1 }
}, Ce.styles = [q, We];
let ut = Ce;
customElements.get("kaleidescape-library") || customElements.define("kaleidescape-library", ut);
const Rs = {
  playing: "Playing",
  paused: "Paused",
  forward: "Scanning forward",
  reverse: "Scanning backward",
  stopped: "Stopped",
  none: "Stopped"
}, Ls = {
  content: "Main content",
  credits: "Credits",
  intermission: "Intermission",
  disc_menu: "Disc menu",
  none: "No active content"
}, Se = class Se extends x {
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
        const d = this.abort = new AbortController(), h = setTimeout(() => d.abort(), 5e3);
        try {
          const c = await e.artwork(
            r.entity_id,
            d.signal
          );
          i === this.generation && c && (this.image = URL.createObjectURL(c));
        } catch (c) {
          if (u(c) === "unauthorized") throw c;
        } finally {
          clearTimeout(h), this.abort === d && (this.abort = void 0);
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
    return e.recording_error ? "Recording needs attention. Check HA diagnostics." : e.recording_paused ? "Recording paused for backup." : e.available ? t && e.recording_exclusion === "below_minimum_runtime" ? `Not recording: runtime is below the minimum of ${$(e.minimum_runtime_minutes, "minute")}.` : t && e.recording_exclusion === "runtime_unknown" ? "Waiting for a known runtime before recording." : "Recording enabled." : "Recording waiting for source entities.";
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
                    ${e.available ? a`<p>${Rs[e.play_status] ?? "Unknown playback state"} · ${Ls[e.location] ?? "Unknown location"}</p>` : l}
                    ${t && e.duration_seconds != null ? a`<p>Runtime · ${(e.duration_seconds / 60).toFixed(2)} min</p>` : l}
                    ${this.scope?.permissions.edit && t && e.session ? a`<p>
                              This session ·
                              ${(e.session.watched_seconds / 60).toFixed(2)}
                              min counted
                            </p>
                            <small
                              >Pauses and scans are excluded.
                              ${e.session.credits_confirmed ? "Credits confirmed; journal completion also requires the configured watch threshold." : "Credits not yet confirmed."}
                              ${e.session.gap_count ? a` ${$(e.session.gap_count, "timing gap")}.` : l}</small
                            >` : l}
                    ${this.scope?.permissions.edit && e.recording_paused !== void 0 ? a`<p role="status">
                            ${this.recordingStatus(e, !!t)}
                            ${e.buffered_observations ? a` ${$(e.buffered_observations, "update")} buffered.` : l}
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
Se.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  playerId: {},
  compact: { type: Boolean, reflect: !0 },
  showControls: { type: Boolean }
}, Se.styles = [
  q,
  S`
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
let gt = Se;
customElements.get("kaleidescape-now-playing") || customElements.define("kaleidescape-now-playing", gt);
const fi = (n, e, t) => {
  const i = /* @__PURE__ */ new Map();
  for (let s = e; s <= t; s++) i.set(n[s], s);
  return i;
}, zs = Ti(class extends Ai {
  constructor(n) {
    if (super(n), n.type !== N.CHILD) throw Error("repeat() can only be used in text expressions");
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
    const s = ks(n), { values: r, keys: o } = this.dt(e, t, i);
    if (!Array.isArray(s)) return this.ut = o, r;
    const d = this.ut ??= [], h = [];
    let c, m, p = 0, y = s.length - 1, v = 0, E = r.length - 1;
    for (; p <= y && v <= E; ) if (s[p] === null) p++;
    else if (s[y] === null) y--;
    else if (d[p] === o[v]) h[v] = O(s[p], r[v]), p++, v++;
    else if (d[y] === o[E]) h[E] = O(s[y], r[E]), y--, E--;
    else if (d[p] === o[E]) h[E] = O(s[p], r[E]), se(n, h[E + 1], s[p]), p++, E--;
    else if (d[y] === o[v]) h[v] = O(s[y], r[v]), se(n, s[p], s[y]), y--, v++;
    else if (c === void 0 && (c = fi(o, v, E), m = fi(d, p, y)), c.has(d[p])) if (c.has(d[y])) {
      const R = m.get(o[v]), U = R !== void 0 ? s[R] : null;
      if (U === null) {
        const te = se(n, s[p]);
        O(te, r[v]), h[v] = te;
      } else h[v] = O(U, r[v]), se(n, s[p], U), s[R] = null;
      v++;
    } else Ze(s[y]), y--;
    else Ze(s[p]), p++;
    for (; v <= E; ) {
      const R = se(n, h[E + 1]);
      O(R, r[v]), h[v++] = R;
    }
    for (; p <= y; ) {
      const R = s[p++];
      R !== null && Ze(R);
    }
    return this.ut = o, Pi(n, h), z;
  }
}), Us = S`
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
function Y(n) {
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function Ts(n = location.search, e = /* @__PURE__ */ new Date()) {
  const t = new URLSearchParams(n).get("companion_month") ?? "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) {
    const [i, s] = t.split("-").map(Number);
    if (i >= 100 && i <= 9998) return new Date(i, s - 1, 1);
  }
  return new Date(e.getFullYear(), e.getMonth(), 1);
}
function As(n) {
  return [
    new Date(n.getFullYear(), n.getMonth(), 1).toISOString(),
    new Date(n.getFullYear(), n.getMonth() + 1, 1).toISOString()
  ];
}
function Ps(n) {
  const e = Y(new Date(n.started_at)), t = n.ended_at ? Y(new Date(n.ended_at)) : e;
  return n.status === "completed" && t !== e && n.ended_at && new Date(n.ended_at) > new Date(n.started_at) ? [
    { day: e, phase: "start" },
    { day: t, phase: "completion" }
  ] : [{ day: e, phase: "single" }];
}
const qe = class qe extends x {
  constructor() {
    super(...arguments), this.query = "", this.status = "", this.fuzzy = !0, this.daySize = 180, this.fitScreen = !1, this.disabled = !1, this.editable = !1, this.rememberUrl = !0, this.fittedSize = 180, this.month = Ts(), this.items = [], this.loading = !1, this.error = "", this.generation = 0, this.signature = "", this.privacy = "", this.queue = new T(), this.selectedArtwork = null, this.movie = null, this.detailRequest = 0, this.detailLoading = !1, this.detailError = "", this.scheduleLayout = () => {
      !this.fitScreen || !this.isConnected || this.layoutFrame !== void 0 || (this.layoutFrame = requestAnimationFrame(() => {
        if (this.layoutFrame = void 0, !this.fitScreen || !this.isConnected) return;
        const e = window.visualViewport?.height ?? window.innerHeight, t = Math.max(
          0,
          this.getBoundingClientRect().top,
          this.previousElementSibling?.getBoundingClientRect().bottom ?? 0
        ), i = this.closest("main"), s = [".month-bar", ".weekday"].reduce(
          (c, m) => c + (this.renderRoot.querySelector(m)?.getBoundingClientRect().height ?? 0),
          0
        ) + (this.nextElementSibling?.getBoundingClientRect().height ?? 0) + (i && parseFloat(getComputedStyle(i).paddingBottom) || 0) + 16, r = new Date(
          this.month.getFullYear(),
          this.month.getMonth(),
          1
        ), o = new Date(
          this.month.getFullYear(),
          this.month.getMonth() + 1,
          0
        ).getDate(), d = Math.ceil((r.getDay() + o) / 7), h = Math.max(48, Math.floor((e - t - s) / d));
        h !== this.fittedSize && (this.fittedSize = h, this.requestUpdate());
      }));
    };
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("resize", this.scheduleLayout), window.visualViewport?.addEventListener("resize", this.scheduleLayout), this.rememberMonth(), this.requestUpdate();
  }
  updated() {
    this.isConnected && (this.resizeObserver || (this.resizeObserver = new ResizeObserver(this.scheduleLayout), this.resizeObserver.observe(this), this.previousElementSibling && this.resizeObserver.observe(this.previousElementSibling), this.nextElementSibling && this.resizeObserver.observe(this.nextElementSibling)), this.scheduleLayout());
  }
  willUpdate() {
    if (!this.isConnected) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    (e !== this.privacy || this.client !== this.boundClient) && (this.clear(), this.privacy = e, this.boundClient = this.client);
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
    super.disconnectedCallback(), window.removeEventListener("resize", this.scheduleLayout), window.visualViewport?.removeEventListener("resize", this.scheduleLayout), this.resizeObserver?.disconnect(), this.resizeObserver = void 0, this.layoutFrame !== void 0 && cancelAnimationFrame(this.layoutFrame), this.layoutFrame = void 0, this.clear(), this.signature = this.privacy = "", this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.closeDetails(), this.items = [], this.error = "", this.loading = !1, this.queue.cache.dispose(), this.queue = new T();
  }
  fail(e) {
    u(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = w(e), this.requestUpdate();
  }
  async load() {
    if (!this.client || !this.scope) return;
    const e = ++this.generation;
    this.closeDetails(), this.items = [], this.totals = void 0, this.loading = !0, this.error = "", this.notifyStatus(), this.requestUpdate();
    try {
      const [t, i] = As(this.month), s = await this.client.calendarMonth(
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
  rememberMonth() {
    if (!this.rememberUrl) return;
    const e = new URL(location.href);
    e.searchParams.set(
      "companion_month",
      `${String(this.month.getFullYear()).padStart(4, "0")}-${String(this.month.getMonth() + 1).padStart(2, "0")}`
    ), history.replaceState(history.state, "", e);
  }
  closeDetails() {
    this.detailRequest++, this.selected = void 0, this.movie = null, this.selectedArtwork = null, this.detailLoading = !1, this.detailError = "", this.renderRoot.querySelector("dialog")?.close();
  }
  async select(e, t = null) {
    if (!this.client || !this.scope) return;
    const i = this.generation, s = ++this.detailRequest;
    if (this.selected = e, this.selectedArtwork = t, this.movie = null, this.detailLoading = !0, this.detailError = "", this.requestUpdate(), await this.updateComplete, !(i !== this.generation || s !== this.detailRequest || !this.isConnected)) {
      this.renderRoot.querySelector("dialog")?.showModal();
      try {
        const r = await this.client.calendarDetails(this.scope, e.id);
        i === this.generation && s === this.detailRequest && (this.selected = r.viewing, this.movie = r.movie, this.selectedArtwork = r.movie?.artwork_key ?? t);
      } catch (r) {
        i === this.generation && s === this.detailRequest && (u(r) === "unauthorized" ? this.fail(r) : this.detailError = w(r));
      } finally {
        i === this.generation && s === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
      }
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
    return a`<button
      type="button"
      class="link detail-link"
      @click=${() => this.browse(e, e === "query" ? JSON.stringify(t) : t)}
    >
      ${t}
    </button>`;
  }
  renderDetails() {
    const e = this.selected, t = this.movie, i = e ? new Date(e.started_at) : null, s = e?.ended_at ? new Date(e.ended_at) : null, r = i && s && Y(i) !== Y(s), o = t?.duration_seconds ?? e?.duration_seconds;
    return a`<dialog
      class="database-dialog calendar-dialog"
      aria-labelledby="calendar-movie-title"
      @click=${C}
      @close=${(d) => {
      d.target.open || (this.closeDetails(), this.requestUpdate());
    }}
    >
      <div class="card-head">
        <h2 id="calendar-movie-title">
          ${e && t ? this.detailLink("query", e.title) : e?.title ?? "Viewing details"}
        </h2>
        ${k(() => {
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
                ${this.detailError ? a`<p class="error" role="alert">${this.detailError} <button @click=${() => this.select(e, this.selectedArtwork)}>Retry details</button></p>` : l}
                ${t ? a`<div class="detail-badges">
                          ${K(t, !1, (d) => this.browse("format", d))}${oe(t.rating ?? "", (d) => this.browse("rating", d))}
                        </div>
                        ${t.year ? a`<p><strong>Year:</strong> ${this.detailLink("year", String(t.year))}</p>` : l}
                        ${[
      ["Cast", t.actors],
      ["Directors", t.directors],
      ["Genres", t.genres]
    ].map(
      ([d, h]) => h?.length ? a`<p>
                                <strong>${d}:</strong>
                                ${h.map((c, m) => a`${m ? ", " : ""}${this.detailLink(d === "Genres" ? "genre" : "query", c)}`)}
                              </p>` : l
    )}` : !this.detailLoading && !this.detailError ? a`<p class="muted">
                          No linked Library metadata is available.
                        </p>` : l}
                ${o != null ? a`<p><strong>Runtime:</strong> ${(o / 60).toFixed(2)} min</p>` : l}
                <p>
                  <strong
                    >${r ? "Viewing dates" : "Viewing date"}:</strong
                  >
                  ${i?.toLocaleDateString()}${r ? ` – ${s.toLocaleDateString()}` : ""}
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
    </dialog>`;
  }
  render() {
    const e = this.month.getFullYear(), t = this.month.getMonth(), i = new Date(e, t, 1), s = new Date(e, t + 1, 0).getDate(), r = Math.ceil((i.getDay() + s) / 7) * 7, o = Array.from(
      { length: r },
      (h, c) => new Date(e, t, c - i.getDay() + 1)
    ), d = /* @__PURE__ */ new Map();
    for (const h of this.items)
      for (const { day: c, phase: m } of Ps(h))
        d.set(c, [...d.get(c) ?? [], { row: h, phase: m }]);
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
      </div>
      <div class="calendar-scroll">
        <div
          class="month-grid"
          style=${`--calendar-day-size:${this.fitScreen ? this.fittedSize : this.daySize}px`}
          aria-label="Viewing calendar"
          aria-busy=${this.loading}
        >
          ${Array.from({ length: 7 }, (h, c) => a`<div class="weekday">${new Date(2023, 0, 1 + c).toLocaleDateString(void 0, { weekday: "short" })}</div>`)}
          ${o.map((h) => {
      const c = Y(h), m = d.get(c) ?? [];
      return a`<section
              class=${`day${h.getMonth() !== t ? " other-month" : ""}${c === Y(/* @__PURE__ */ new Date()) ? " today" : ""}`}
              aria-label=${h.toLocaleDateString()}
            >
              <time datetime=${c}>${h.getDate()}</time>
              ${m.length ? a`<div
                      class="cover-stack"
                      style=${`--spread:${1 + (m.length - 1) * 0.15}`}
                    >
                      ${zs(
        m,
        ({ row: p }) => p.id,
        ({ row: p, phase: y }, v) => a`<button
                            class=${`poster poster-${y}`}
                            style=${`--index:${v};--layer:${v + 1}`}
                            aria-label=${`${p.title} · ${y === "start" ? "Started; completed on another day" : y === "completion" ? "Completed; started on another day" : p.status === "completed" ? "Completed" : "Partial"}`}
                            title=${p.title}
                            ?disabled=${this.disabled}
                            @click=${() => this.select(p, p.artwork_key)}
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
qe.properties = {
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
  rememberUrl: { type: Boolean }
}, qe.styles = [q, We, Us];
let mt = qe;
customElements.get("kaleidescape-journal-calendar") || customElements.define("kaleidescape-journal-calendar", mt);
const js = [
  "remote",
  "now-playing",
  "library-covers",
  "library-search",
  "library",
  "journal-calendar"
];
function ji(n, e) {
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
function Ds(n) {
  const e = (o) => ({ name: o, selector: { text: {} } }), t = (o) => ({ name: o, selector: { boolean: {} } }), i = (o, d, h) => ({
    name: o,
    selector: { number: { min: d, max: h, step: 1, mode: "box" } }
  }), s = n === "library" || n === "library-covers", r = ji(
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
const tt = "kaleidescape-companion-card-search", le = class le extends x {
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
    return Ds(this.kind);
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
    this.config = ji(e, this.kind), this.reset(), this.requestUpdate("hass");
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener(tt, this.receiveSearch), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("hass");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener(tt, this.receiveSearch), document.removeEventListener("visibilitychange", this.visibility), this.reset();
  }
  reset() {
    this.generation++, clearTimeout(this.timer), this.api = void 0, this.scope = void 0, this.identity = "", this.boundConnection = void 0, this.criterion = this.popupCriterion = void 0, this.calendarStatus = void 0, this.query = this.error = "", this.locked = !1, this.renderRoot?.querySelector("dialog")?.close();
  }
  willUpdate(e) {
    if (!e.has("hass") || !this.config) return;
    const t = `${this.hass?.user?.id}:${this.hass?.user?.is_admin}:${this.hass?.connection.connected}`;
    t === this.identity && this.hass?.connection === this.boundConnection || (this.reset(), this.identity = t, this.boundConnection = this.hass?.connection, !(!this.hass?.connection.connected || !this.hass.user) && (this.api = new Ft({
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
        throw new b("not_ready");
      this.scope = {
        ...i,
        permissions: { read: !0, edit: !1, export: !1 }
      }, this.error = "";
    } catch (t) {
      if (e !== this.generation) return;
      this.scope = void 0, this.error = w(t);
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
      new CustomEvent(tt, {
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
                            >${Bt(this.scope, this.calendarStatus, !0)}</span
                          >${Vt(this.calendarStatus, () => {
      this.renderRoot.querySelector("kaleidescape-journal-calendar")?.refresh();
    })}
                        </footer>` : this.scope.library_enabled ? t() : a`<p class="message">
                          Library is disabled. An administrator can enable it in
                          Companion settings.
                        </p>` : a`<p class="message" role="status">
                ${this.hass?.user ? "Loading Companion…" : "Sign in to Home Assistant to use this card."}
              </p>`}
      ${this.popupCriterion && this.scope?.library_enabled ? a`<dialog @click=${C} @cancel=${this.closePopup}>
              <div class="card-head">
                <h2>Library</h2>
                ${k((i) => this.closePopup(i), this.locked)}
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
le.kind = "library", le.properties = { hass: { attribute: !1 } }, le.styles = [
  q,
  Li,
  S`
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
let ft = le;
const bi = {
  remote: "Theater remote",
  "now-playing": "Now Playing",
  "library-covers": "Library covers",
  "library-search": "Library search",
  library: "Full Library",
  "journal-calendar": "Journal calendar"
}, bt = window;
bt.customCards ??= [];
for (const n of js) {
  const e = `kaleidescape-${n}-card`;
  if (!customElements.get(e)) {
    const i = class i extends ft {
    };
    i.kind = n;
    let t = i;
    customElements.define(e, t);
  }
  bt.customCards.some((t) => t.type === e) || bt.customCards.push({
    type: e,
    name: `Kaleidescape · ${bi[n]}`,
    description: bi[n],
    preview: !0
  });
}
class Ms {
  constructor(e, t) {
    this.host = e, this.resized = t, this.observed = [], this.containers = [], this.schedule = () => {
      this.frame !== void 0 || !this.host.isConnected || (this.frame = requestAnimationFrame(() => {
        if (this.frame = void 0, !this.host.isConnected) return;
        const i = Math.min(
          window.innerHeight,
          this.viewport?.height ?? window.innerHeight,
          document.documentElement.clientHeight || window.innerHeight
        ), s = Math.max(0, this.viewport?.offsetTop ?? 0), r = Math.max(0, window.innerHeight - i - s), o = this.observed.reduce(
          (R, U) => R + U.getBoundingClientRect().height,
          0
        ), d = parseFloat(
          getComputedStyle(this.host).getPropertyValue(
            "--companion-sticky-top"
          )
        ) || 0, h = this.observed.find(
          (R) => R.classList.contains("entries-header")
        ), c = this.observed.find(
          (R) => R.classList.contains("entries-footer")
        ), m = this.host.renderRoot.querySelector(".entries-layout"), p = Math.max(
          s + d + (h?.getBoundingClientRect().height ?? 0),
          m?.getBoundingClientRect().top ?? 0
        );
        let y = s + i;
        for (const R of this.containers.slice(1)) {
          if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(R).overflowY))
            continue;
          const U = R.getBoundingClientRect();
          U.height > 0 && (y = Math.min(y, U.bottom));
        }
        const v = {
          "--companion-viewport-height": i,
          "--companion-viewport-top": s,
          "--companion-viewport-bottom": r,
          "--entries-height": Math.max(
            180,
            m ? y - p - (c?.getBoundingClientRect().height ?? 0) - 16 : i - o - d - 16
          )
        };
        let E = !1;
        for (const [R, U] of Object.entries(v)) {
          const te = `${Math.round(U)}px`;
          this.host.style.getPropertyValue(R) !== te && (this.host.style.setProperty(R, te), E = !0);
        }
        E && this.resized?.();
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
function Jt(n, e) {
  n.addController(new Ms(n, e));
}
const Ee = class Ee extends x {
  constructor() {
    super(...arguments), this.viewingId = "", this.disabled = !1, this.queue = new T(), this.error = "", this.generation = 0, this.bound = "";
  }
  willUpdate() {
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.viewingId}`;
    e === this.bound && this.client === this.boundClient || (this.clear(), this.bound = e, this.boundClient = this.client, this.load());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.bound = "", this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.queue.cache.dispose(), this.queue = new T(), this.link = void 0, this.error = "";
  }
  async load() {
    if (!this.client || !this.scope?.library_enabled || !this.viewingId) return;
    const e = this.generation;
    try {
      const t = await this.client.viewingLibrary(
        this.scope,
        this.viewingId
      );
      e === this.generation && (this.link = t.library);
    } catch (t) {
      if (e !== this.generation) return;
      this.error = w(t), u(t) === "unauthorized" && (this.clear(), this.requestUpdate(), this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      ));
    } finally {
      e === this.generation && this.requestUpdate();
    }
  }
  render() {
    return this.scope?.library_enabled ? this.error ? a`<p class="error" role="alert">
        ${this.error} <button @click=${this.load}>Retry Library link</button>
      </p>` : this.link === null ? a`<p class="muted">No linked Library entry is available.</p>` : this.link ? a`<div class="linked-movie">
      <kaleidescape-library-cover
        .client=${this.client}
        .scope=${this.scope}
        .queue=${this.queue}
        .artworkKey=${this.link.artwork_key}
        .title=${this.link.title}
        @access-denied=${() => {
      this.clear(), this.requestUpdate();
    }}
      ></kaleidescape-library-cover>
      <button
        class="link"
        ?disabled=${this.disabled}
        @click=${() => this.dispatchEvent(
      new CustomEvent("open-library-title", {
        detail: this.link.title_id,
        bubbles: !0,
        composed: !0
      })
    )}
      >
        View in Library: ${this.link.title}
      </button>
    </div>` : l : l;
  }
};
Ee.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  viewingId: { type: String },
  disabled: { type: Boolean }
}, Ee.styles = [
  q,
  S`
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
let yt = Ee;
customElements.get("kaleidescape-viewing-library") || customElements.define("kaleidescape-viewing-library", yt);
function pe(n) {
  const e = new Date(n);
  return new Date(e.getTime() - e.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
}
function yi(n) {
  return {
    title: n?.title ?? "",
    started_at: pe(n?.started_at ?? (/* @__PURE__ */ new Date()).toISOString()),
    ended_at: n?.ended_at ? pe(n.ended_at) : "",
    duration_seconds: n?.duration_seconds == null ? "" : (n.duration_seconds / 60).toFixed(2),
    watched_seconds: ((n?.watched_seconds ?? 0) / 60).toFixed(2),
    status: n?.status ?? "partial",
    notes: n?.notes ?? "",
    source_id: n?.source_id ?? "",
    player_id: n?.player_id ?? "",
    raw_content_id: n?.raw_content_id ?? ""
  };
}
function Os(n, e, t, i = n) {
  const s = { ...n, [e]: t };
  if (e === "started_at") {
    const r = new Date(t).getTime(), o = new Date(i.started_at).getTime(), d = new Date(i.ended_at).getTime();
    t && i.ended_at && [r, o, d].every(Number.isFinite) && (s.ended_at = pe(
      new Date(r + d - o).toISOString()
    ));
  }
  return s;
}
function Ns(n, e) {
  const t = {};
  for (const [i, s] of Object.entries(n))
    e && s === e[i] || (i === "started_at" || i === "ended_at" ? t[i] = s ? new Date(s).toISOString() : null : i === "duration_seconds" || i === "watched_seconds" ? t[i] = s === "" ? null : Number(s) * 60 : ["source_id", "player_id", "raw_content_id"].includes(i) ? t[i] = s === "" ? null : s : t[i] = s);
  return t;
}
function Is(n, e, t) {
  function i(s, r, o = "text", d = !1, h) {
    return a`<label
      >${r}<input
        id=${s === "title" ? "title" : s}
        name=${s}
        type=${o}
        .value=${n[s]}
        ?required=${d}
        maxlength=${h ?? l}
        min=${o === "number" ? "0" : l}
        max=${o === "number" ? String(1e9 / 60) : l}
        step=${o === "datetime-local" ? "1" : o === "number" ? "0.01" : l}
        @input=${(c) => e(s, c)}
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
const Re = class Re extends x {
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
        t === this.request && (this.error = w(i), this.requestUpdate(), u(i) === "unauthorized" && this.dispatchEvent(
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
      ${this.selected ? a`<p class="manual-metadata">${this.selected.year ?? ""} ${K(this.selected)} ${oe(this.selected.rating)} · ${((this.selected.duration_seconds ?? 0) / 60).toFixed(2)} min</p>` : l}
    </fieldset>`;
  }
};
Re.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  value: { type: String },
  initialTitle: { type: String },
  requireRuntime: { type: Boolean },
  disabled: { type: Boolean },
  fuzzySearch: { attribute: !1 }
}, Re.styles = [q, We];
let vt = Re;
customElements.get("kaleidescape-library-title-picker") || customElements.define(
  "kaleidescape-library-title-picker",
  vt
);
function be() {
  const n = pe((/* @__PURE__ */ new Date()).toISOString());
  return {
    library_title_id: "",
    date: n.slice(0, 10),
    time: n.slice(11, 16),
    status: "completed",
    watched_minutes: "",
    notes: ""
  };
}
function Di(n) {
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
  if (!Number.isFinite(o.getTime()) || pe(o.toISOString()) !== r)
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
const Le = class Le extends x {
  constructor() {
    super(...arguments), this.draft = be(), this.disabled = !1, this.fuzzySearch = !0, this.runtime = null;
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
Le.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  draft: { attribute: !1 },
  disabled: { type: Boolean },
  fuzzySearch: { attribute: !1 }
}, Le.styles = [q, We];
let wt = Le;
customElements.get("kaleidescape-manual-viewing") || customElements.define("kaleidescape-manual-viewing", wt);
const Kt = S`
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
`, Fs = [
  "now-playing",
  "library",
  "journal",
  "database",
  "settings"
];
function $t(n, e, t, i = !0) {
  const s = (o) => Fs.includes(o) && (e || o === "now-playing" || o === "journal" || o === "library") && (o !== "library" || t), r = i ? new URL(location.href).searchParams.get("companion_page") : null;
  return s(r) ? r : s(n) ? n : "journal";
}
function I(n) {
  const e = new URL(location.href);
  e.searchParams.set("companion_page", n), history.replaceState(history.state, "", e);
}
const ze = class ze extends x {
  constructor() {
    super(), this.disabled = !1, this.status = "", this.mobileCompact = !1, this.view = "list", this.calendarSize = 180, this.calendarFit = !1, this.bound = "", this.generation = 0, this.ready = !1, this.fuzzy = !0, this.error = "", ue(this, () => !this.ready || this.store?.unsettled || this.viewStore?.unsettled || this.disabled || this.renderRoot.querySelector("dialog[open]") ? !1 : (this.clear(), this.load(), !0));
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
    this.generation++, this.store?.dispose(), this.store = void 0, this.viewStore?.dispose(), this.viewStore = void 0, this.view = "list", this.calendarSize = 180, this.calendarFit = !1, this.ready = !1, this.fuzzy = !0, this.error = "", this.renderRoot.querySelector("dialog")?.close();
  }
  notify() {
    this.dispatchEvent(
      new CustomEvent("journal-options", {
        detail: {
          fuzzy_search: this.fuzzy,
          view: this.view,
          calendar_size: this.calendarSize,
          calendar_fit: this.calendarFit
        },
        bubbles: !0,
        composed: !0
      })
    );
  }
  fail(e) {
    this.error = w(e), u(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.requestUpdate();
  }
  async load() {
    if (!this.client || !this.scope) return;
    const e = ++this.generation;
    this.store?.dispose(), this.store = new j(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t ? this.fail(t) : (this.error = "", this.requestUpdate()));
      },
      "search"
    ), this.viewStore?.dispose(), this.viewStore = new j(
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
      this.fuzzy = t.fuzzy_search, this.view = i.view, this.calendarSize = i.calendar_size, this.calendarFit = i.calendar_fit, this.ready = !0, this.error = "", this.notify(), this.requestUpdate();
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
        @click=${C}
      >
        <div class="card-head">
          <h2 id="journal-options-title">Journal options</h2>
          ${k(() => this.renderRoot.querySelector("dialog")?.close())}
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
ze.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean },
  status: { type: String },
  mobileCompact: { type: Boolean }
}, ze.styles = [
  q,
  S`
      @media (max-width: 700px) {
        .desktop-options {
          display: none;
        }
      }
    `
];
let xt = ze;
customElements.get("kaleidescape-journal-options") || customElements.define("kaleidescape-journal-options", xt);
const Ue = class Ue extends x {
  constructor() {
    super(), this.narrow = !1, this.api = null, this.userKey = "", this.generation = 0, this.scope = null, this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest = 0, this.loading = !1, this.error = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.sort = "completed_at", this.descending = !0, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.next = null, this.history = [], this.page = 1, this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.controlLocked = !1, Jt(this);
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
          new Ft({
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
    this.controlLocked = !1, this.generation++, this.scope = null, this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest++, this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.query = this.status = this.searchText = this.filterStatus = "", this.sort = "completed_at", this.descending = !0, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.calendarStatus = void 0, this.journalMovie = void 0, this.libraryTitleId = void 0, this.libraryCriterion = void 0, this.loading = !1, this.error = "";
  }
  bind(e) {
    e !== this.api && (this.clear(), this.api = e, this.requestUpdate(), e && this.refresh());
  }
  fail(e) {
    u(e) === "unauthorized" && this.clear(), this.error = w(e), this.requestUpdate();
  }
  async refresh() {
    if (!this.api) return;
    const e = ++this.generation;
    this.scope = null, this.rows = [], this.selected = null, this.detailLoading = !1, this.detailRequest++, this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const { entries: t } = await this.api.info();
      if (e !== this.generation) return;
      if (!t[0]?.permissions.read || t[0].api_version !== 1)
        throw new b("not_ready");
      if (this.scope = {
        ...t[0],
        permissions: { read: !0, edit: !1, export: !1 }
      }, !this.navigationReady) {
        const i = $t(
          this.scope.ui_defaults?.default_landing_page,
          !1,
          !!this.scope.library_enabled
        );
        this.activePage = i === "library" || i === "now-playing" ? i : "journal", this.navigationReady = !0;
      }
      this.activePage === "library" && !this.scope.library_enabled && (this.activePage = "journal"), I(this.activePage), this.announcePage(), await this.load(void 0, e);
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
  async selectRecord(e) {
    if (!this.api || !this.scope) return;
    const t = this.generation, i = ++this.detailRequest;
    this.selected = null, this.detailLoading = !0, this.requestUpdate();
    try {
      const s = await this.api.get(this.scope, e);
      t === this.generation && i === this.detailRequest && (this.selected = s);
    } catch (s) {
      t === this.generation && i === this.detailRequest && this.fail(s);
    } finally {
      t === this.generation && i === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  date(e) {
    if (!e) return "—";
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? "—" : t.toLocaleString();
  }
  selectPage(e, t) {
    this.controlLocked || e === "library" && !this.scope?.library_enabled || (this.selected = null, this.detailLoading = !1, this.detailRequest++, this.libraryTitleId = t?.libraryTitleId, this.libraryCriterion = t?.libraryCriterion, this.activePage = e, e === "journal" && (this.journalMovie = t?.movie, this.query = this.searchText = this.status = this.filterStatus = "", this.page = 1, this.history = [], this.load()), I(e), this.announcePage(), this.requestUpdate());
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
  render() {
    return a`<main>
      <header>
        ${this.hass && this.narrow ? a`<button aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : l}
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
          ${["now-playing", "library", "journal"].map((e) => a`<button id=${`reader-${e}`} role="tab" aria-controls="reader-content" aria-selected=${this.activePage === e} tabindex=${this.activePage === e ? 0 : -1} ?disabled=${e === "library" && !this.scope?.library_enabled} @click=${() => this.selectPage(e)}>${e === "now-playing" ? "Now Playing" : e === "journal" ? "Journal" : "Library"}</button>`)}
        </nav>
        <span class="view-mode-slot"><slot name="view-mode"></slot></span>
      </div>
      <section
        id="reader-content"
        @control-lock=${(e) => {
      this.controlLocked !== e.detail && (this.controlLocked = e.detail, this.requestUpdate());
    }}
        role="tabpanel"
        aria-labelledby=${`reader-${this.activePage}`}
        @playback-started=${(e) => {
      this.playbackPlayer = e.detail, this.selectPage("now-playing");
    }}
      >
        ${this.activePage === "now-playing" && this.scope ? a`<kaleidescape-now-playing
                .playerId=${this.playbackPlayer}
                .client=${this.api ?? void 0}
                .scope=${this.scope}
                @access-denied=${() => this.fail(new b("unauthorized"))}
              ></kaleidescape-now-playing>` : this.activePage === "library" && this.scope ? a`<kaleidescape-library
                  .client=${this.api ?? void 0}
                  .scope=${this.scope}
                  .openTitleId=${this.libraryTitleId}
                  .openCriterion=${this.libraryCriterion}
                  @open-title-journal=${(e) => this.selectPage("journal", { movie: e.detail })}
                  @access-denied=${() => this.fail(new b("unauthorized"))}
                  @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
                ></kaleidescape-library>` : a`<section
                  class=${`card journal${this.journalView === "calendar" ? " journal-calendar-mode" : ""}`}
                  aria-label="Viewing history"
                >
                  <div class="entries-header">
                    ${this.journalView === "calendar" ? a`<kaleidescape-journal-shortcuts
                            .context=${this.api}
                            .scopeKey=${`${this.scope?.entry_id}:${this.scope?.dataset_id}`}
                            .value=${this.searchText}
                            .disabled=${this.loading || !this.scope}
                            .allowAdd=${!1}
                            .filtered=${!!this.status || !!this.journalMovie}
                            .filterLabel=${this.journalMovie ? `Viewings for ${this.journalMovie.title}` : ""}
                            @journal-search=${(e) => {
      this.query = this.searchText = e.detail, this.page = 1, this.history = [], this.load();
    }}
                            @journal-clear=${() => {
      this.query = this.searchText = this.status = this.filterStatus = "", this.journalMovie = void 0, this.page = 1, this.history = [], this.load();
    }}
                            @journal-open-options=${() => this.renderRoot.querySelector("kaleidescape-journal-options")?.open()}
                          ></kaleidescape-journal-shortcuts>` : l}
                    ${this.journalMovie ? a`<p class="journal-movie-filter">Viewings for ${this.journalMovie.title} <button @click=${() => this.selectPage("journal")}>Show all viewings</button></p>` : l}
                    <form
                      class="filters journal-filters"
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
                      <div class="journal-filter-tools">
                        <label ?hidden=${this.journalView === "calendar"}
                          >Sort by<select
                            name="journal_sort"
                            .value=${this.sort}
                            ?disabled=${this.loading || !this.scope}
                            @change=${(e) => {
      this.sort = e.target.value, this.page = 1, this.history = [], this.load();
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
                          ?hidden=${this.journalView === "calendar"}
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
                          .mobileCompact=${this.journalView === "calendar"}
                          @journal-refresh=${() => this.refresh()}
                          .status=${this.status}
                          @journal-status=${(e) => {
      this.status = this.filterStatus = e.detail, this.page = 1, this.history = [], this.load(), this.requestUpdate();
    }}
                          .client=${this.api}
                          .scope=${this.scope}
                          .disabled=${this.loading}
                          @journal-options=${(e) => {
      this.journalView = e.detail.view, this.calendarSize = e.detail.calendar_size, this.calendarFit = e.detail.calendar_fit, this.requestUpdate();
      const t = this.fuzzySearch !== e.detail.fuzzy_search;
      this.fuzzySearch = e.detail.fuzzy_search, t && (this.page = 1, this.history = [], this.load());
    }}
                          @access-denied=${() => this.fail(new b("unauthorized"))}
                        ></kaleidescape-journal-options>
                      </div>
                    </form>
                  </div>
                  ${this.journalView === "calendar" ? a`<kaleidescape-journal-calendar
                          @calendar-status=${(e) => {
      this.calendarStatus = e.detail, this.requestUpdate();
    }}
                          .client=${this.api ?? void 0}
                          .scope=${this.scope ?? void 0}
                          .query=${this.query}
                          .status=${this.status}
                          .fuzzy=${this.fuzzySearch}
                          .libraryTitleId=${this.journalMovie?.id}
                          .daySize=${this.calendarSize}
                          .fitScreen=${this.calendarFit}
                          @browse-library=${(e) => this.selectPage("library", { libraryCriterion: e.detail })}
                          @access-denied=${() => this.fail(new b("unauthorized"))}
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
                                          ${this.rows.map((e) => Ei(e, this.selected?.id, (t) => {
      this.selectRecord(t);
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
                                    </div>` : this.selected ? a`${Ri(this.selected, (e) => this.date(e))}
                                        <kaleidescape-viewing-library
                                          .client=${this.api ?? void 0}
                                          .scope=${this.scope ?? void 0}
                                          .viewingId=${this.selected.id}
                                          @access-denied=${() => this.fail(new b("unauthorized"))}
                                          @open-library-title=${(e) => this.selectPage("library", { libraryTitleId: e.detail })}
                                        ></kaleidescape-viewing-library>` : a`<div class="empty">
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
                      >${Bt(this.scope, this.journalView === "calendar" ? this.calendarStatus : void 0, this.journalView === "calendar")}</span
                    >${this.journalView === "calendar" ? Vt(this.calendarStatus, () => {
      this.renderRoot.querySelector(
        "kaleidescape-journal-calendar"
      )?.refresh();
    }) : l}

                    <div
                      class="pagination"
                      ?hidden=${this.journalView === "calendar"}
                    >
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
Ue.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, Ue.styles = [q, Kt, zi];
let kt = Ue;
customElements.get("kaleidescape-reader") || customElements.define("kaleidescape-reader", kt);
function Bs(n, e) {
  return a`<label class="check"
      ><input
        type="checkbox"
        name="calendar_full_sync"
        .checked=${!!n.calendar_full_sync}
        @change=${(t) => e({ calendar_full_sync: t.target.checked, calendar_full_sync_dedicated: !1 })}
      />Full Sync · maintain the assigned calendar</label
    >
    ${n.calendar_full_sync ? a`
            <p class="warning">
              <strong
                >Full Sync requires its own separate calendar. Events in the
                selected age window that do not match a completed database
                Journal entry will be permanently deleted.</strong
              >
            </p>
            <label class="check"
              ><input
                type="checkbox"
                name="calendar_full_sync_dedicated"
                required
                .checked=${!!n.calendar_full_sync_dedicated}
                @change=${(t) => e({ calendar_full_sync_dedicated: t.target.checked })}
              />I assigned a separate dedicated calendar and understand
              unmatched events will be deleted.</label
            >
            <div class="grid settings-grid">
              <label
                >Full Sync age window · months<input
                  name="calendar_full_sync_months"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  required
                  .value=${String(n.calendar_full_sync_months ?? 3)}
                  @input=${(t) => e({ calendar_full_sync_months: Number(t.target.value) })}
              /></label>
              <label
                >Daily sweep · HA local time<input
                  name="calendar_full_sync_time"
                  type="time"
                  required
                  .value=${String(n.calendar_full_sync_time ?? "03:00")}
                  @input=${(t) => e({ calendar_full_sync_time: t.target.value })}
              /></label>
            </div>
            <p class="muted">
              Saved Journal edits are checked about every 10 seconds. The daily
              sweep finds external calendar changes. Unmatched events require
              repeated successful scans and at least 10 minutes of grace before
              deletion. Older and future events are left outside this window;
              recurring events are skipped. Providers without event editing
              receive a verified replacement before the old event is removed.
            </p>
          ` : l}`;
}
const Te = class Te extends x {
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
    u(e) === "unauthorized" ? (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )) : this.error = w(e), this.requestUpdate();
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
      ].includes(u(t)) && (this.pending = void 0), this.fail(t);
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
        ${$(e.uncertain, "unconfirmed write")}
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
        @click=${C}
        @cancel=${this.close}
        aria-labelledby="maintenance-review-title"
      >
        <div class="card-head">
          <h2 id="maintenance-review-title">
            Review unconfirmed calendar writes
          </h2>
          ${k((t) => this.close(t))}
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
        @click=${C}
        @cancel=${this.close}
        aria-labelledby="maintenance-run-title"
      >
        <div class="card-head">
          <h2 id="maintenance-run-title">
            Run Full Sync with pending operations?
          </h2>
          ${k((t) => this.close(t))}
        </div>
        <p>
          Pending delete: ${e.quarantined} ·
          ${$(e.uncertain, "unconfirmed write")}
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
              ${$(e.total, "viewing")} ·
              ${Object.entries(e.counts).map(([t, i]) => `${i} ${t}`).join(" · ")}
            </p>` : l}
      ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
      <dialog
        class="database-dialog"
        aria-labelledby="calendar-export-title"
        aria-describedby="calendar-export-summary"
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="calendar-export-title">Export Journal to calendar</h2>
          ${k((t) => this.close(t))}
        </div>
        <p id="calendar-export-summary">
          Create events for up to
          ${$(this.status?.completed_viewings ?? 0, "completed viewing")}
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
Te.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, Te.styles = q;
let _t = Te;
customElements.get("kaleidescape-calendar-export") || customElements.define("kaleidescape-calendar-export", _t);
const Vs = [
  ["rules", "Runtime rules and feature enablement"],
  ["browsing", "Personal browsing preferences · may include searches/names"],
  ["shared", "Shared hidden collection names"],
  ["connections", "Network addresses, player and HA entity choices · private"],
  ["templates", "Custom calendar text templates · private"]
], Ae = class Ae extends x {
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
    this.error = w(e), u(e) === "unauthorized" && (this.reset(), this.dispatchEvent(
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
      e === "apply" && (this.request ||= Q(), this.pending = !0);
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
        @click=${C}
        @cancel=${(t) => this.close(t)}
      >
        <div class="card-head">
          <h2>Export / import settings</h2>
          ${k(() => this.close())}
        </div>
        <p>
          Choose the categories to transfer. Credentials are always excluded.
          Connection choices, searches, names and templates can contain private
          information; protect the downloaded file.
        </p>
        ${Vs.map(
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
Ae.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, Ae.styles = q;
let Ct = Ae;
customElements.define("kaleidescape-settings-transfer", Ct);
function Z(n) {
  return Array.isArray(n) ? `[${n.map(Z).join(",")}]` : n && typeof n == "object" ? `{${Object.entries(n).sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => `${JSON.stringify(e)}:${Z(t)}`).join(",")}}` : JSON.stringify(n);
}
class A extends Error {
}
class Hs {
  constructor(e, t) {
    if (this.client = e, this.plan = t, this.attempted = !1, this.created = !1, !/^companion-test-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      t.url_path
    ) || new TextEncoder().encode(t.yaml).length > 262144)
      throw new A("Invalid generated dashboard artifact");
  }
  async install(e) {
    const t = () => {
      if (!e())
        throw new A(
          "Dashboard setup stopped because the HA account or dataset changed."
        );
    }, i = await this.client.haDashboards();
    t();
    const s = i.find(
      (d) => d.url_path === this.plan.url_path
    );
    if (s && (!this.attempted || s.title !== this.plan.title || s.mode !== "storage" || s.icon !== "mdi:test-tube" || s.require_admin !== !1 || s.show_in_sidebar !== !0))
      throw new A(
        "The dashboard URL already exists or its settings changed. Existing dashboards are never replaced."
      );
    if (!s) {
      if (this.created)
        throw new A(
          "The newly created dashboard was removed. Start a new generation request."
        );
      if (this.attempted)
        throw new A(
          "Creation was already attempted, but HA has not exposed the result. Wait and check again or inspect Dashboards; no second create was sent."
        );
      this.attempted = !0, await this.client.createHATestDashboard(this.plan), t(), this.created = !0;
    }
    let r;
    try {
      r = await this.client.haTestDashboardConfig(this.plan.url_path), t();
    } catch (d) {
      if (t(), u(d) !== "config_not_found") throw d;
    }
    if (r) {
      if (Z(r) === Z(this.plan.config)) return;
      throw new A(
        "This dashboard already contains different content. It was not overwritten. Inspect it in HA dashboard settings."
      );
    }
    if (!this.created && !s)
      throw new A("Could not verify the new dashboard");
    await this.client.saveHATestDashboard(this.plan), t();
    const o = await this.client.haTestDashboardConfig(
      this.plan.url_path
    );
    if (t(), Z(o) !== Z(this.plan.config))
      throw new A(
        "The saved dashboard could not be verified. Inspect it before continuing."
      );
  }
}
const Pe = class Pe extends x {
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
      if (this.request ||= Q(), !this.plan) {
        const s = await this.client.testDashboard(
          this.scope,
          this.request,
          this.name.trim()
        );
        if (!i()) return;
        this.installer = new Hs(this.client, s), this.plan = s;
      }
      if (this.pending = !0, await this.installer.install(i), !i() || (await this.client.verifyTestDashboard(this.scope, this.request), !i())) return;
      this.complete = !0, this.pending = !1;
    } catch (s) {
      if (!i()) return;
      const r = u(s), o = s?.message;
      this.error = typeof o == "string" && (r.startsWith("dashboard_") || s instanceof A) ? o : w(s), r === "unauthorized" && (this.reset(), this.dispatchEvent(
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
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>Generate test dashboard</h2>
          ${k((e) => this.close(e))}
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
Pe.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, Pe.styles = q;
let St = Pe;
customElements.get("kaleidescape-test-dashboard") || customElements.define("kaleidescape-test-dashboard", St);
const je = class je extends x {
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
    u(e) === "unauthorized" ? (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )) : this.error = w(e), this.requestUpdate();
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
      ].includes(u(t)) && (this.pending = void 0, this.review = void 0), this.fail(t);
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
      ${this.result ? a`<p role="status">Updated ${$(this.result.updated_count, "entry", "entries")} · ${this.result.unmatched_count} unmatched · ${this.result.active_count} active and skipped.</p>` : l}
      ${this.error ? a`<p role="alert" class="error">${this.error}</p>` : l}
      <dialog
        class="database-dialog"
        aria-labelledby="metadata-repair-title"
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="metadata-repair-title">Repair Journal Library metadata</h2>
          ${k((t) => this.close(t))}
        </div>
        ${e ? a`<p>${$(e.updated_count, "entry", "entries")} with missing details can be updated. ${e.unchanged_count} already up to date · ${e.unmatched_count} unmatched · ${e.active_count} active and skipped.</p>` : l}
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
je.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, je.styles = q;
let qt = je;
customElements.get("kaleidescape-metadata-repair") || customElements.define("kaleidescape-metadata-repair", qt);
const vi = [
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
], Ws = {
  auto: "Automatic",
  original: "Original library data",
  kaleidescape: "Kaleidescape store",
  tmdb: "TMDB"
}, De = class De extends x {
  constructor() {
    super(...arguments), this.draft = {}, this.disabled = !1, this.generation = 0, this.bound = "", this.error = "", this.loading = !1;
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
    this.dispatchEvent(
      new CustomEvent("metadata-settings", {
        detail: { [e]: t },
        bubbles: !0,
        composed: !0
      })
    );
  }
  async refresh(e = !1) {
    if (this.loading || !this.scope?.permissions.edit || !this.client) return;
    this.loading = !0, clearTimeout(this.timer), this.requestUpdate();
    const t = this.generation;
    try {
      const i = await this.client.metadataStatus(this.scope, e);
      if (t !== this.generation) return;
      this.status = i, this.error = "", i.running && (this.timer = setTimeout(() => {
        this.refresh();
      }, 2e3));
    } catch (i) {
      t === this.generation && (this.error = w(i));
    } finally {
      t === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  render() {
    return this.scope?.permissions.edit ? a`<section aria-label="External metadata">
      <h3>External movie metadata</h3>
      <p class="muted">
        Optional internet lookups share movie titles and release years with the
        enabled provider. Store enrichment uses existing purchase store links;
        it sends no prices or order IDs. Both providers are disabled by default.
        Save settings before syncing.
      </p>
      ${[
      ["metadata_store_enabled", "Kaleidescape public store (experimental)"],
      ["metadata_tmdb_enabled", "TMDB"]
    ].map(
      ([e, t]) => a`<label class="check"
            ><input
              name=${e}
              type="checkbox"
              .checked=${!!this.draft[e]}
              ?disabled=${this.disabled}
              @change=${(i) => this.change(e, i.target.checked)}
            />Enable ${t}</label
          >`
    )}
      <div class="grid settings-grid">
        <label
          >Requests per second · shared limit<input
            name="metadata_requests_per_second"
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            .value=${String(this.draft.metadata_requests_per_second ?? 2)}
            ?disabled=${this.disabled}
            @input=${(e) => this.change("metadata_requests_per_second", Number(e.target.value))}
        /></label>
        <label
          >TMDB API key or API Read Access Token<input
            name="metadata_tmdb_credential"
            type="password"
            autocomplete="new-password"
            maxlength="1024"
            placeholder="Blank keeps the saved credential"
            .value=${String(this.draft.metadata_tmdb_credential ?? "")}
            ?disabled=${this.disabled}
            @input=${(e) => this.change("metadata_tmdb_credential", e.target.value)}
        /></label>
      </div>
      <label class="check"
        ><input
          name="metadata_clear_tmdb_key"
          type="checkbox"
          .checked=${!!this.draft.metadata_clear_tmdb_key}
          ?disabled=${this.disabled}
          @change=${(e) => this.change("metadata_clear_tmdb_key", e.target.checked)}
        />Remove saved TMDB credential</label
      >
      <details class="field-sources">
        <summary>Preferred metadata sources</summary>
        <p class="muted">
          These shared choices apply to the whole Library after Save settings.
          Missing provider values fall back to another cached source. Original
          library data uses only the scanned field. Per-title edits and reviewed
          selections take priority. Enabling a preference does not enable a
          scraper.
        </p>
        <button
          type="button"
          ?disabled=${this.disabled || !this.draft.metadata_tmdb_enabled}
          @click=${() => {
      const e = Object.fromEntries(
        vi.map(([t, , i]) => [
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
        <div class="grid settings-grid">
          ${vi.map(([e, t, i]) => {
      const s = "metadata_source_" + e;
      return a`<label
              >${t}<select
                name=${s}
                .value=${String(this.draft[s] ?? "auto")}
                ?disabled=${this.disabled}
                @change=${(r) => this.change(s, r.target.value)}
              >
                ${["auto", "original", ...i].map((r) => a`<option value=${r}>${e === "artwork" && r === "kaleidescape" ? "Kaleidescape library cover" : Ws[r]}</option>`)}
              </select></label
            >`;
    })}
        </div>
        <p class="muted">
          Kaleidescape covers use the edition artwork already cached from your
          player. TMDB covers download on the next metadata refresh when Sync
          artwork is enabled. Landscape images currently come from TMDB.
          Disabled scrapers make no requests; their existing cache can still be
          used.
        </p>
      </details>
      <p class="muted">
        Successful scans enrich new or week-old metadata. Ambiguous matches are
        skipped. Provider errors stop the pass; no automatic HTTP retry. Refresh
        metadata forces a pass using saved settings.
      </p>
      <div class="actions">
        <button
          type="button"
          ?disabled=${this.disabled || this.loading || this.status?.running}
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
      ${this.status ? a`<p role="status">${this.status.running ? "Syncing" : "Idle"} · ${this.status.processed} of ${$(this.status.total, "movie")} · ${$(this.status.updated, "provider update")} · ${$(this.status.skipped, "skipped attempt")}${this.status.error ? ` · ${this.status.error}` : ""}</p>` : l}
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      <details>
        <summary>Metadata credits</summary>
        ${Ui()}
        <p>
          Kaleidescape store metadata and Rotten Tomatoes scores remain
          attributed to their source. TMDB votes are a separate audience rating.
        </p>
      </details>
    </section>` : l;
  }
};
De.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  draft: { attribute: !1 },
  disabled: { type: Boolean }
}, De.styles = q;
let Et = De;
customElements.get("kaleidescape-enrichment-settings") || customElements.define("kaleidescape-enrichment-settings", Et);
const it = [
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
], wi = [
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
], Mi = [
  ["library_allow_collection_add", "Allow Add to Collection on the device"],
  ["library_sync_collections", "Sync collections and watched status"],
  ["library_sync_details", "Sync title details and credits"],
  ["library_sync_artwork", "Sync artwork"]
], Js = /* @__PURE__ */ new Set([
  "calendar_enabled",
  "calendar_full_sync",
  "calendar_full_sync_dedicated",
  "tracking_enabled",
  "library_enabled",
  "control_enabled",
  "control_allow_launch",
  "metadata_store_enabled",
  "metadata_tmdb_enabled",
  "metadata_clear_tmdb_key",
  ...Mi.map(([n]) => n)
]), Ks = {
  invalid_calendar_full_sync: "Use 1–12 whole months and a daily time in HH:MM format.",
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
  invalid_library_options: "Choose a sync interval of 1–168 hours and an artwork cache limit of 32–4096 MiB."
}, Me = class Me extends x {
  constructor() {
    super(), this.tab = "home-assistant", this.personalReady = !1, this.personalError = "", this.generation = 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.hiddenCollections = [], this.sharedReady = !1, this.sharedError = "", this.customCollection = "", this.loading = !1, this.saving = !1, this.uncertain = !1, this.dashboardBusy = !1, this.error = "", this.bound = "", ue(this, () => this.loading || this.saving || this.uncertain || this.personalPreferences?.unsettled ? !1 : (this.personalPreferences?.dispose(), this.personalPreferences = void 0, this.personalReady = !1, this.tab === "personal" && this.selectTab("personal"), !0));
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
    this.personalPreferences?.dispose(), this.personalPreferences = void 0, this.personalReady = !1, this.personalError = "", this.sharedPreferences?.dispose(), this.sharedPreferences = void 0, this.hiddenCollections = [], this.sharedReady = !1, this.sharedError = "", this.generation++, this.flow?.flow_id && this.boundClient && this.boundScope && this.boundClient.settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id }).catch(() => {
    });
  }
  fail(e) {
    this.error = w(e), u(e) === "unauthorized" && (this.personalPreferences?.dispose(), this.personalPreferences = void 0, this.personalReady = !1, this.sharedPreferences?.dispose(), this.sharedPreferences = void 0, this.sharedReady = !1, this.hiddenCollections = [], this.flow = void 0, this.draft = {}, this.initial = {}, this.dispatchEvent(
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
          Js.has(o.name) ? !!o.default : String(o.default ?? "")
        ])
      ), this.initial = { ...this.draft }, this.sharedPreferences = new j(
        e,
        t,
        !0,
        (o) => {
          i === this.generation && (o && u(o) === "unauthorized" ? this.fail(o) : (this.sharedError = o ? w(o) : "", this.requestUpdate()));
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
      i === this.generation && (this.loading = !1, this.tab === "personal" && this.selectTab("personal"), this.requestUpdate());
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
    return this.saving || t && !t.confirmNavigation() || e && !e.confirmNavigation() || i && !i.confirmNavigation() ? !1 : this.uncertain ? window.confirm(
      "The settings save may already have committed. Leave this view and inspect saved values before making another change?"
    ) : JSON.stringify(this.draft) === JSON.stringify(this.initial) || window.confirm("Discard your unsaved settings changes?");
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("settings-busy", {
        detail: this.saving || this.dashboardBusy,
        bubbles: !0,
        composed: !0
      })
    );
  }
  reload() {
    this.confirmNavigation() && (this.cancelFlow(), this.flow = void 0, this.draft = this.initial = {}, this.uncertain = !1, this.start());
  }
  async save(e) {
    if (e.preventDefault(), !this.client || !this.scope || !this.flow?.flow_id || this.saving || this.uncertain || this.dashboardBusy || !e.target.reportValidity()) return;
    const t = this.generation;
    this.saving = !0, this.busy(), this.error = "", this.requestUpdate();
    const i = { ...this.draft };
    for (const [s, , r] of it)
      r === "number" ? i[s] = Number(i[s]) : i[s] || delete i[s];
    for (const [s, , r] of wi)
      r === "number" && (i[s] = Number(i[s]));
    i.library_host = String(i.library_host ?? ""), i.calendar_full_sync_months !== void 0 && (i.calendar_full_sync_months = Number(i.calendar_full_sync_months)), i.calendar_entity || delete i.calendar_entity;
    try {
      const s = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data: i
      });
      if (t !== this.generation) return;
      this.flow = s, s.type === "create_entry" ? (this.initial = { ...this.draft }, this.saving = !1, this.busy(), this.dispatchEvent(
        new CustomEvent("settings-saved", { bubbles: !0, composed: !0 })
      )) : s.type === "form" ? this.error = Object.values(s.errors ?? {}).map(
        (r) => Ks[r] ?? "Check the settings and try again."
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
  async selectTab(e) {
    if (this.tab = e, this.requestUpdate(), e !== "personal" || this.personalPreferences || !this.client || !this.scope)
      return;
    const t = this.generation;
    this.personalPreferences = new j(
      this.client,
      this.scope,
      !1,
      (i) => {
        t === this.generation && (i && u(i) === "unauthorized" ? this.fail(i) : (this.personalError = i ? w(i) : "", this.requestUpdate()));
      },
      "search"
    );
    try {
      if (await this.personalPreferences.load(), t !== this.generation) return;
      this.personalReady = !0;
    } catch (i) {
      if (t !== this.generation) return;
      this.personalError = w(i), this.personalPreferences?.dispose(), this.personalPreferences = void 0, u(i) === "unauthorized" && this.fail(i);
    }
    this.requestUpdate();
  }
  tabKey(e, t) {
    const i = [
      "home-assistant",
      "companion",
      "personal",
      "ecosystem",
      "scrapers"
    ], s = i.indexOf(t), r = e.key === "ArrowRight" ? i[(s + 1) % i.length] : e.key === "ArrowLeft" ? i[(s + i.length - 1) % i.length] : e.key === "Home" ? i[0] : e.key === "End" ? i.at(-1) : void 0;
    r && (e.preventDefault(), this.selectTab(r), this.renderRoot.querySelector(`#settings-tab-${r}`)?.focus());
  }
  async submitForm() {
    const e = this.renderRoot.querySelector(
      "#companion-settings-form"
    );
    if (!e) return;
    const t = [
      ...e.querySelectorAll("input, select, textarea")
    ].find((s) => s.willValidate && !s.validity.valid), i = t?.closest("[data-settings-tab]")?.dataset.settingsTab;
    if (i && i !== this.tab && (await this.selectTab(i), await this.updateComplete), t) {
      t.focus(), t.reportValidity();
      return;
    }
    e.requestSubmit();
  }
  renderSources() {
    return a`<div class="grid settings-grid">
      ${it.filter(([, , e]) => e === "text").map(
      ([e, t]) => a` <label class="full"
              >${t}<input
                name=${e}
                maxlength="255"
                ?required=${!!this.draft.tracking_enabled}
                .value=${String(this.draft[e] ?? "")}
                @input=${(i) => {
        this.draft = {
          ...this.draft,
          [e]: i.target.value
        };
      }}
            /></label>`
    )}
    </div>`;
  }
  render() {
    return a`<section
      class="card settings-page"
      aria-labelledby="settings-title"
    >
      <div class="settings-actions">
        <h2 id="settings-title">Companion settings</h2>
        <div class="actions">
          <button
            type="button"
            ?disabled=${this.saving || this.loading}
            @click=${this.reload}
          >
            Cancel changes</button
          ><button
            class="primary"
            type="button"
            @click=${this.submitForm}
            ?disabled=${this.saving || this.loading || this.uncertain || this.dashboardBusy || this.flow?.type !== "form"}
          >
            ${this.saving ? "Saving…" : "Save settings"}
          </button>
        </div>
        <nav
          class="settings-tabs"
          role="tablist"
          aria-label="Settings categories"
        >
          ${[
      ["home-assistant", "Home Assistant"],
      ["companion", "Companion"],
      ["personal", "Personal"],
      ["ecosystem", "Kaleidescape"],
      ["scrapers", "Scrapers"]
    ].map(
      ([e, t]) => a` <button
                type="button"
                role="tab"
                id=${`settings-tab-${e}`}
                aria-controls=${`settings-${e}`}
                aria-selected=${this.tab === e}
                tabindex=${this.tab === e ? 0 : -1}
                @click=${() => this.selectTab(e)}
                @keydown=${(i) => this.tabKey(i, e)}
              >
                ${t}
              </button>`
    )}
        </nav>
      </div>
      <p>
        Integration configuration is shared and reloads when saved. Companion
        database preferences save immediately. Each section identifies its
        scope.
      </p>
      ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
      ${this.uncertain ? a`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : l}
      ${this.loading ? a`<p role="status">Loading settings…</p>` : this.flow?.type === "form" ? a`<form
                  id="companion-settings-form"
                  @submit=${this.save}
                  @input=${() => this.requestUpdate()}
                  @change=${() => this.requestUpdate()}
                >
                  <fieldset ?disabled=${this.saving || this.uncertain}>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-home-assistant"
                      aria-labelledby="settings-tab-home-assistant"
                      data-settings-tab="home-assistant"
                      ?hidden=${this.tab !== "home-assistant"}
                    >
                      <p class="settings-scope">
                        Home Assistant integration · shared · Save settings
                        required
                      </p>
                      <kaleidescape-test-dashboard
                        .client=${this.client}
                        .scope=${this.scope}
                        .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                        @dashboard-busy=${(e) => {
      this.dashboardBusy !== e.detail && (this.dashboardBusy = e.detail, this.busy(), this.requestUpdate());
    }}
                        @access-denied=${() => this.fail(new b("unauthorized"))}
                      ></kaleidescape-test-dashboard>
                      <h3>Playback source entities</h3>
                      <p class="muted">
                        Choose the HA entities used for automatic journal
                        recording. Recording rules are under Companion.
                      </p>
                      ${this.renderSources()}
                      <h3>Watched movies calendar</h3>
                      <label class="check"
                        ><input
                          type="checkbox"
                          name="calendar_enabled"
                          .checked=${!!this.draft.calendar_enabled}
                          @change=${(e) => {
      this.draft = {
        ...this.draft,
        calendar_enabled: e.target.checked
      }, this.requestUpdate();
    }}
                        />Add watched movies to calendar</label
                      >
                      <p class="muted">
                        Publishes new movie completions automatically. Use the
                        explicit Journal export below to sync existing completed
                        viewings. Movie metadata is shared with the calendar
                        provider and anyone who can read that calendar.
                      </p>
                      ${this.draft.calendar_enabled ? a`<div class="grid settings-grid">
                                <label class="full"
                                  >HA calendar<input
                                    name="calendar_entity"
                                    list="calendar-choices"
                                    type="text"
                                    placeholder="calendar.movies"
                                    maxlength="255"
                                    required
                                    .value=${String(this.draft.calendar_entity ?? "")}
                                    @input=${(e) => {
      this.draft = {
        ...this.draft,
        calendar_entity: e.target.value,
        calendar_full_sync_dedicated: !1
      };
    }} /></label
                                ><label class="full"
                                  >Event title<input
                                    name="calendar_title"
                                    type="text"
                                    maxlength="500"
                                    required
                                    .value=${String(this.draft.calendar_title ?? "Watched: {title}")}
                                    @input=${(e) => {
      this.draft = {
        ...this.draft,
        calendar_title: e.target.value
      };
    }} /></label
                                ><label class="full"
                                  >Event description<textarea
                                    name="calendar_description"
                                    maxlength="5000"
                                    .value=${String(this.draft.calendar_description ?? "")}
                                    @input=${(e) => {
      this.draft = {
        ...this.draft,
        calendar_description: e.target.value
      };
    }}
                                  ></textarea>
                                </label>
                              </div>
                              <p class="muted">
                                <datalist id="calendar-choices">
                                  ${(this.flow.calendar_choices ?? []).map((e) => a`<option value=${e.value}>${e.label}</option>`)}
                                </datalist>
                                Allowed fields: {title}, {year}, {collection},
                                {cast}, {director}, {writer}, {studio}, {genre},
                                {duration}, {rating}, {format}, {edition},
                                {synopsis}, {purchase_date}, {added_on},
                                {status}, {started_at}, {ended_at}, {watched}.
                                Duration and watched time are minutes; missing
                                values are blank. Use double braces for literal
                                braces.
                              </p>
                              ${Bs(this.draft, (e) => {
      this.draft = { ...this.draft, ...e }, this.requestUpdate();
    })}` : l}
                      <kaleidescape-calendar-export
                        .client=${this.client}
                        .scope=${this.scope}
                        .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                      ></kaleidescape-calendar-export>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-companion"
                      aria-labelledby="settings-tab-companion"
                      data-settings-tab="companion"
                      ?hidden=${this.tab !== "companion"}
                    >
                      <p class="settings-scope">
                        Companion runtime behavior · shared · saved with the HA
                        integration
                      </p>
                      <h3>Journal recording</h3>
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
                        ${it.filter(([, , e]) => e === "number").map(
      ([e, t, i, s, r]) => a`<label class=${i === "text" ? "full" : ""}
                                >${t}<input
                                  name=${e}
                                  type=${i}
                                  min=${s || l}
                                  max=${r || l}
                                  step=${i === "number" ? "1" : l}
                                  maxlength=${i === "text" ? "255" : l}
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
                        The runtime cutoff uses total duration; missing runtime
                        waits for metadata. Completion uses watched time and
                        confirmed credits. Select the HA source entities under
                        Home Assistant.
                      </p>
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
      ([e, t]) => a`<option
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
                        size, filters and sort save automatically for your HA
                        user while browsing.
                      </p>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-ecosystem"
                      aria-labelledby="settings-tab-ecosystem"
                      data-settings-tab="ecosystem"
                      ?hidden=${this.tab !== "ecosystem"}
                    >
                      <p class="settings-scope">
                        Kaleidescape devices and metadata providers · shared ·
                        Save settings required
                      </p>
                      <p>
                        Loaded pykaleidescape version:
                        <strong>${this.scope?.pyk_version || "Unknown"}</strong>
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
                      ${this.draft.library_enabled ? a`<div class="grid settings-grid">
                                ${wi.map(
      ([e, t, i, s, r]) => a`<label
                                      class=${i === "text" ? "full" : ""}
                                      >${t}<input
                                        name=${e}
                                        type=${i}
                                        min=${s || l}
                                        max=${r || l}
                                        step=${i === "number" ? "1" : l}
                                        maxlength=${i === "text" ? "255" : l}
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
                                ${Mi.map(
      ([e, t]) => a`<label class="check full"
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
                                explicitly selected version to an existing
                                offered collection. It requires collection sync.
                                Removal is not supported.
                              </p>
                              <p class="muted">
                                Source collections determine watched status,
                                with in-progress. Detail fields depend on
                                available source metadata. “Added on” means
                                first detected, not purchased or downloaded.
                              </p>
                              ${this.draft.library_sync_artwork ? a`<p class="warning">Artwork uses additional disk space in a separate private cache, up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. Increase the cache limit for a large library; older covers may be evicted and fetched again. HA backups can include these files.</p>` : l}` : l}
                      ${this.initial.library_enabled ? a`<kaleidescape-metadata-repair
                              .client=${this.client}
                              .scope=${this.scope}
                              .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                            ></kaleidescape-metadata-repair>` : l}
                      <h3>Device discovery and controls</h3>
                      <label class="check"
                        ><input
                          name="control_enabled"
                          type="checkbox"
                          .checked=${!!this.draft.control_enabled}
                          @change=${(e) => {
      this.draft = {
        ...this.draft,
        control_enabled: e.target.checked
      }, this.requestUpdate();
    }}
                        />Enable playback controls</label
                      >
                      <label
                        >Control hostname · blank uses the Library host<input
                          name="control_host"
                          maxlength="255"
                          .value=${String(this.draft.control_host ?? "")}
                          @input=${(e) => {
      this.draft = {
        ...this.draft,
        control_host: e.target.value
      }, this.requestUpdate();
    }}
                      /></label>
                      <kaleidescape-device-controls
                        mode="settings"
                        .client=${this.client}
                        .scope=${this.scope}
                        .value=${String(this.draft.control_player ?? "")}
                        .configured=${this.draft.control_enabled === this.initial.control_enabled && this.draft.control_host === this.initial.control_host}
                        @player-selected=${(e) => {
      this.draft = {
        ...this.draft,
        control_player: e.detail
      }, this.requestUpdate();
    }}
                      ></kaleidescape-device-controls>
                      <label class="check"
                        ><input
                          name="control_allow_launch"
                          type="checkbox"
                          .checked=${!!this.draft.control_allow_launch}
                          @change=${(e) => {
      this.draft = {
        ...this.draft,
        control_allow_launch: e.target.checked
      }, this.requestUpdate();
    }}
                        />Allow experimental Library title playback</label
                      >
                      <p class="muted">
                        Enabled controls are available to all active HA users
                        and use TCP 10000. Commands run when clicked without
                        confirmation. Discovery reads the configured system
                        without waking players. Save enablement/host first,
                        discover, select a movie player, then save again. The
                        control target is separate from Journal tracking.
                        Library playback uses the same catalog seed and verifies
                        the selected title before launch; the player chooses its
                        playable format.
                      </p>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-scrapers"
                      aria-labelledby="settings-tab-scrapers"
                      data-settings-tab="scrapers"
                      ?hidden=${this.tab !== "scrapers"}
                    >
                      <p class="settings-scope">
                        Metadata providers · shared backend behavior · Save
                        settings required
                      </p>
                      <p class="muted">
                        Optional provider requests are separate from the local
                        Kaleidescape library scan. Each scraper requires
                        administrator opt-in.
                      </p>
                      <kaleidescape-enrichment-settings
                        .client=${this.client}
                        .scope=${this.scope}
                        .draft=${this.draft}
                        .disabled=${this.saving || this.uncertain}
                        @metadata-settings=${(e) => {
      this.draft = {
        ...this.draft,
        ...e.detail
      }, this.requestUpdate();
    }}
                      ></kaleidescape-enrichment-settings>
                    </section>
                  </fieldset>
                </form>
                <section
                  class="settings-section"
                  ?hidden=${this.tab !== "companion"}
                >
                  <h3>Shared Library display settings</h3>
                  <p class="settings-scope">
                    Companion database · shared · saved immediately without an
                    HA reload
                  </p>
                  ${this.renderCollections()}
                  <h3>Settings transfer and maintenance</h3>
                  <p class="muted">
                    Export or review selected settings categories before import.
                    Reload discards unsaved integration changes.
                  </p>
                  <div class="actions">
                    <button
                      ?disabled=${this.saving || this.loading}
                      @click=${this.reload}
                    >
                      Reload settings
                    </button>
                    <kaleidescape-settings-transfer
                      .client=${this.client}
                      .scope=${this.scope}
                      .disabled=${this.saving || this.loading}
                      @settings-imported=${(e) => {
      this.draft = { ...this.draft, ...e.detail }, this.requestUpdate();
    }}
                    ></kaleidescape-settings-transfer>
                  </div>
                </section>
                <section
                  class="settings-section"
                  role="tabpanel"
                  id="settings-personal"
                  aria-labelledby="settings-tab-personal"
                  ?hidden=${this.tab !== "personal"}
                >
                  <p class="settings-scope">
                    Companion database · your HA account only · saved
                    immediately
                  </p>
                  <h3>Search behavior</h3>
                  <label class="check"
                    ><input
                      type="checkbox"
                      name="personal_fuzzy_search"
                      .checked=${this.personalPreferences?.values.fuzzy_search !== !1}
                      ?disabled=${!this.personalReady}
                      @change=${(e) => {
      this.personalPreferences?.set({
        fuzzy_search: e.target.checked
      }), this.requestUpdate();
    }}
                    />Fuzzy search across all views</label
                  >
                  ${this.personalError ? a`<p class="error" role="alert">${this.personalError}<button type="button" @click=${() => this.personalPreferences?.retry()}>Retry personal settings</button></p>` : l}
                  <h3>View preferences</h3>
                  <p>
                    Library, Journal and Database Options save view layouts,
                    page sizes and display choices for your account as you
                    browse. Library filters and sorting are personal too.
                  </p>
                  <p class="muted">
                    The default landing page under Companion is shared. The URL
                    remembers the current main view.
                  </p>
                </section>` : l}
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
      <legend>Hidden collection names</legend>
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
              />${B(i)}</label
            >`
    )}
      </div>
      <div class="actions field-actions">
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
Me.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, Me.styles = [
  q,
  S`
      [hidden] {
        display: none !important;
      }
      .settings-tabs {
        flex-basis: 100%;
        display: flex;
        overflow-x: auto;
        border-bottom: 1px solid var(--line);
      }
      .settings-tabs button {
        border: 0;
        border-radius: 0;
        border-bottom: 3px solid transparent;
        background: transparent;
        white-space: nowrap;
      }
      .settings-tabs button[aria-selected="true"] {
        color: var(--accent);
        border-bottom-color: var(--accent);
      }
      .settings-section {
        padding: 8px 0 20px;
      }
      .settings-section > h3:first-child {
        margin-top: 8px;
      }
      .settings-section + .settings-section {
        border-top: 1px solid var(--line);
      }
      .settings-scope {
        font-size: 13px;
        color: var(--muted);
        margin: 0 0 20px;
      }
    `
];
let Rt = Me;
customElements.get("kaleidescape-settings") || customElements.define("kaleidescape-settings", Rt);
const Ys = S`
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
`, Oe = class Oe extends x {
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
        this.invalid = !0, this.message = u(t) === "query_syntax" && typeof t.message == "string" ? t.message : w(t), u(t) === "unauthorized" && this.dispatchEvent(
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
Oe.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  table: {},
  value: {},
  fields: { attribute: !1 },
  operators: { attribute: !1 },
  disabled: { type: Boolean }
}, Oe.styles = S`
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
let Lt = Oe;
customElements.get("kaleidescape-database-search") || customElements.define("kaleidescape-database-search", Lt);
const Ne = class Ne extends x {
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
      this.error = w(t), u(t) === "unauthorized" && this.dispatchEvent(
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
                ${e.title} · ${e.year ?? "Year unknown"}<small
                  >${e.directors.join(", ") || "Director unknown"} ·
                  ${$(e.version_count, "version")} · Source
                  ${e.source_hint}</small
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
Ne.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  review: { attribute: !1 },
  row: { attribute: !1 },
  disabled: { type: Boolean }
}, Ne.styles = [
  q,
  S`
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
let zt = Ne;
customElements.get("kaleidescape-import-matcher") || customElements.define(
  "kaleidescape-import-matcher",
  zt
);
const Ie = class Ie extends x {
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
    this.generation++, this.controller?.abort(), this.controller = void 0, this.file = void 0, this.review = void 0, this.matching = void 0, this.selected.clear();
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
    this.matching = void 0, this.renderRoot.querySelector("dialog")?.close(), this.dialog = null;
  }
  closeDialog(e) {
    e?.preventDefault();
    const t = this.dialog;
    this.clear(), this.file = void 0, this.review = void 0, this.matching = void 0, this.selected.clear();
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
    )), this.error = w(e), this.requestUpdate();
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
    if (!this.client || !this.scope || !this.file || this.working || this.disabled || this.scope.tracking_enabled)
      return;
    const e = this.generation, t = this.controller = new AbortController(), i = setTimeout(() => t.abort(), 65e3);
    this.working = !0, this.error = this.notice = "", this.review = void 0, this.matching = void 0, this.selected.clear(), this.busy(), this.requestUpdate();
    try {
      const s = await this.client.previewImport(
        this.scope,
        this.file,
        t.signal
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
    if (!this.client || !this.scope || !this.review || this.matching || this.working || this.disabled || this.scope.tracking_enabled)
      return;
    this.pending ??= this.client.prepareImport(this.scope, this.review, [
      ...this.selected
    ]);
    const e = this.generation;
    this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const t = await this.client.applyImport(this.pending);
      if (e !== this.generation) return;
      this.pending = void 0, this.review = void 0, this.matching = void 0, this.file = void 0, this.selected.clear(), this.notice = `Imported ${$(t.imported_count, "new entry", "new entries")}; filled missing data in ${t.updated_count}; left ${t.skipped_count} unchanged or unselected.`, this.hideDialog(), this.dispatchEvent(
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
      ].includes(u(t)) && (this.pending = void 0, this.review = void 0, this.matching = void 0, this.selected.clear()), this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.busy(), this.requestUpdate());
    }
  }
  async openMatch(e) {
    this.scope?.tracking_enabled || (this.matching = e, this.requestUpdate(), await this.updateComplete, this.matching === e && await this.renderRoot.querySelector("kaleidescape-import-matcher")?.focusSearch());
  }
  async chooseMatch(e) {
    if (!this.client || !this.scope || !this.review || !this.matching || this.scope.tracking_enabled || this.working || this.pending || this.disabled)
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
      }, this.matching = void 0, ["new", "merge"].includes(s.row.action) ? this.selected.add(i) : this.selected.delete(i), this.page = 0;
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
      (h) => (!this.changesOnly || h.needs_match || !h.needs_match && ["new", "merge"].includes(h.action)) && dt(
        `${h.title} ${h.detail ?? ""} ${h.table} ${Object.keys(h.changes).join(" ")}`,
        i
      )
    ).sort(
      (h, c) => +!!c.needs_match - +!!h.needs_match
    ), r = Math.max(0, Math.ceil(s.length / this.pageSize) - 1), o = Math.min(this.page, r), d = s.slice(
      o * this.pageSize,
      (o + 1) * this.pageSize
    );
    return a`${this.matching ? a`<kaleidescape-import-matcher
              .client=${this.client}
              .scope=${this.scope}
              .review=${t}
              .row=${this.matching}
              .disabled=${e}
              @match-choice=${(h) => this.chooseMatch(h.detail)}
              @match-cancel=${() => {
      this.matching = void 0, this.requestUpdate();
    }}
              @access-denied=${() => this.fail({ code: "unauthorized" })}
            ></kaleidescape-import-matcher>` : l}
      <p role="status">
        ${t.counts.new} new · ${t.counts.merge} mergeable ·
        ${t.counts.unchanged} unchanged · ${t.counts.skip} skipped.
        ${this.selected.size} selected.
        ${t.rows.some((h) => h.needs_match) ? a`${$(t.rows.filter((h) => h.needs_match).length, "purchase requiring a match")} shown first.` : l}
      </p>
      ${t.rows.some((h) => h.key.startsWith("purchases:")) ? a`<p class="muted">
              Purchase records are attached to the matched existing Library
              entry. New means a new purchase record, not a new movie. Purchase
              titles preserve the store's wording; Library titles are kept
              unchanged.
            </p>` : l}
      <div class="actions">
        <label
          >Search review<input
            type="search"
            .value=${this.query}
            ?disabled=${e}
            @input=${(h) => {
      this.query = h.target.value, this.page = 0, this.requestUpdate();
    }}
        /></label>
        <label class="check"
          ><input
            type="checkbox"
            .checked=${this.changesOnly}
            ?disabled=${e}
            @change=${(h) => {
      this.changesOnly = h.target.checked, this.page = 0, this.requestUpdate();
    }}
          />Changes only</label
        >
        <button
          ?disabled=${e}
          @click=${() => {
      this.selected = new Set(
        t.rows.filter(
          (h) => !h.needs_match && ["new", "merge"].includes(h.action)
        ).map((h) => h.key)
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
            ${d.map((h) => {
      const c = h.key.startsWith("purchases:"), m = c ? h.needs_match ? "Choose Library match" : {
        new: "Add purchase to Library entry",
        merge: "Update purchase record",
        unchanged: "Purchase already imported",
        skip: "Skip purchase"
      }[h.action] : h.action;
      return a`<tr>
                <td>
                  <input
                    type="checkbox"
                    aria-label=${`Import ${h.title}`}
                    .checked=${this.selected.has(h.key)}
                    ?disabled=${e || !!h.needs_match || !["new", "merge"].includes(h.action)}
                    @change=${(p) => {
        p.target.checked ? this.selected.add(h.key) : this.selected.delete(h.key), this.requestUpdate();
      }}
                  />
                </td>
                <td>
                  ${h.title}<small class="muted" title=${h.key}
                    >${h.detail}</small
                  ><small class="muted"
                    >${c ? "Purchase history on Library entry" : h.table}</small
                  >
                </td>
                <td>${m}</td>
                <td>
                  ${h.reason || Object.keys(h.changes).join(", ") || "No missing data"}
                  ${h.needs_match ? a`<small class="warning">No Library match selected</small>` : l}
                  ${h.can_match ? a`<button
                          ?disabled=${e || !!this.matching || !!this.scope?.tracking_enabled}
                          @click=${() => this.openMatch(h)}
                        >
                          Match title…
                        </button>` : l}
                  ${h.conflicts.length ? a`<small class="muted">Existing ${c ? "purchase " : ""}values kept: ${h.conflicts.join(", ")}</small>` : l}
                  ${Object.keys(h.changes).length ? a`<details>
                          <summary>
                            ${c ? h.action === "new" ? "Purchase record to add" : "Purchase record changes" : "Changes"}
                          </summary>
                          <pre>${JSON.stringify(h.changes, null, 2)}</pre>
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
      <div class="actions">
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
            @change=${(h) => {
      this.pageSize = Number(h.target.value), this.page = 0, this.requestUpdate();
    }}
          >
            ${[25, 100, 500].map((h) => a`<option value=${h}>${h}</option>`)}
          </select></label
        >
      </div>`;
  }
  renderImport(e) {
    return a`<p>
        Add new IDs and fill missing data in existing viewings and Library
        versions. Populated values, manual corrections and deletion status are
        kept. Only known Library sources match. Newly imported versions stay
        inactive until a server sync verifies them. Session evidence, collection
        membership, artwork files, audit and retry state are not restored.
        Maximum 32 MiB / 10,000 records. Review expires after 10 minutes or any
        database change. Purchase JSON keeps separate orders and proposes
        exact-name Library group links for review. Ambiguous names stay
        unlinked. Purchase rows start unchecked; select the purchases and links
        you approve.
      </p>
      ${this.scope?.tracking_enabled ? a`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : l}
      <label
        >JSON or SQLite file<input
          type="file"
          accept=".json,.sqlite,.sqlite3,.db"
          ?disabled=${e || !!this.scope?.tracking_enabled}
          @change=${(t) => {
      this.file = t.target.files?.[0], this.review = void 0, this.matching = void 0, this.selected.clear(), this.error = this.notice = "", this.requestUpdate();
    }}
      /></label>
      ${this.file ? a`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : l}
      <div class="actions">
        <button
          ?disabled=${e || !this.file || !!this.scope?.tracking_enabled}
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
        @click=${C}
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : "Merge Import"}
          </h2>
          ${k((t) => this.closeDialog(t))}
        </div>
        ${this.error && this.dialog ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.dialog === "export" ? a`<p>
                Exports include private history and deleted records. SQLite also
                includes catalog and source metadata. Store downloads securely.
              </p> ` : this.dialog === "import" ? this.renderImport(e) : l}
        ${this.dialog === "export" || this.dialog === "import" && this.review ? a`<div class="actions dialog-footer">
                ${this.dialog === "export" ? a`<button ?disabled=${e} @click=${() => this.exportData("json")}>Export JSON</button><button class="primary" ?disabled=${e} @click=${() => this.exportData("sqlite")}>Export SQLite</button>` : a`<button class="primary" ?disabled=${e || !!this.matching || !this.selected.size} @click=${this.importData}>Apply ${$(this.selected.size, "selected change")}</button>`}
              </div>` : l}
      </dialog>`;
  }
};
Ie.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, Ie.styles = [
  q,
  S`
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
let Ut = Ie;
customElements.get("kaleidescape-transfers") || customElements.define("kaleidescape-transfers", Ut);
const ae = {
  viewings: "Viewings",
  sessions: "Sessions",
  library: "Library",
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
  library_collection_intents: "Collection add receipts",
  calendar_publications: "Calendar publications",
  calendar_sync_jobs: "Calendar exports",
  calendar_sync_items: "Calendar export items"
}, re = ["viewings", "sessions", "library"], Fe = class Fe extends x {
  constructor() {
    super(), this.bound = "", this.generation = 0, this.mutationEpoch = 0, this.request = 0, this.table = "viewings", this.filters = { limit: 25, query: "", descending: !1 }, this.fitPage = !0, this.showSystem = !1, this.sorts = {}, this.fuzzySearch = !0, this.ready = !1, this.preferenceError = "", this.loading = !1, this.saving = !1, this.transferBusy = !1, this.error = "", this.notice = "", this.search = "", this.selected = /* @__PURE__ */ new Set(), this.operation = null, this.draft = {}, this.nulls = /* @__PURE__ */ new Set(), this.original = "", this.createDraft = be(), this.confirmed = !1, this.deleteWord = "", this.covers = new T(), this.scheduleFit = () => {
      clearTimeout(this.fitTimer), !(!this.fitPage || !this.ready || !this.page || this.blocked || this.operation) && (this.fitTimer = setTimeout(() => this.resizePage(), 120));
    }, Jt(this, () => this.scheduleFit()), ue(this, () => {
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
    this.covers.cache.dispose(), this.covers = new T(), this.generation++, this.request++, this.preferences?.dispose(), this.preferences = void 0, this.fuzzySearch = !0, this.ready = !1, this.page = void 0, this.table = "viewings", this.fitPage = !0, this.filters = { limit: 25, query: "", descending: !1 }, this.showSystem = !1, this.sorts = {}, this.detail = void 0, this.selected.clear(), this.pending = void 0, this.operation = null, this.draft = {}, this.original = "", this.search = "", this.confirmed = !1, this.deleteWord = "", this.loading = this.saving = this.transferBusy = !1, this.error = this.notice = this.preferenceError = "";
    for (const e of this.renderRoot.querySelectorAll("dialog"))
      e.close();
    this.busy(), this.requestUpdate();
  }
  async initialize(e) {
    const t = ++this.generation;
    this.preferences?.dispose(), this.preferences = new j(
      this.client,
      this.scope,
      !1,
      (i) => {
        t === this.generation && (i && u(i) === "unauthorized" ? this.fail(i) : (this.preferenceError = i ? w(i) : "", this.requestUpdate()));
      },
      "database"
    );
    try {
      const [i, s] = await Promise.all([
        this.preferences.load(),
        this.client.uiPreferences(this.scope, !1, "search")
      ]);
      if (t !== this.generation) return;
      this.fuzzySearch = s.values.fuzzy_search, this.fitPage = i.limit === "fit" || i.limit === void 0, this.filters.limit = this.fitPage ? 25 : i.limit, this.showSystem = i.show_system, this.sorts = i.sorts ?? {}, this.table = String(i.table ?? "viewings"), !this.showSystem && !re.includes(this.table) && (this.table = "viewings"), this.filters = { ...this.filters, ...this.sorts[this.table] }, e && (this.table = e.table, this.showSystem ||= !re.includes(this.table), this.filters = { ...e.filters, limit: this.filters.limit }, this.search = this.filters.query), this.ready = !0, await this.load(
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
    this.error = ["query_syntax", "conflict", "invalid_request", "busy"].includes(t) && typeof i == "string" && i !== t ? i : w(e), this.requestUpdate();
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
        const d = o.schema?.filter((h) => h.primary).map((h) => h.name) ?? [];
        this.detail = o.items.find(
          (h) => d.length ? d.every((c) => h[c] === i[c]) : JSON.stringify(h) === JSON.stringify(i)
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
    re.includes(e.table) || (this.showSystem = !0, this.preferences?.set({ show_system: !0 })), this.table = e.table, this.search = `WHERE ${t.join(" AND ")}`, this.filters = {
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
    this.blocked || this.table !== "viewings" || (this.operation = "new", this.createDraft = be(), this.original = JSON.stringify(this.createDraft), this.confirmed = !1, this.open("database-edit"));
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
              data: Di(this.createDraft)
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
          ].includes(u(s)) && (this.pending = void 0), this.fail(s);
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
      @click=${C}
    >
      <div class="card-head">
        <h2>Database options</h2>
        ${k(() => this.renderRoot.querySelector("#database-options")?.close())}
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
      this.showSystem = e.target.checked, this.preferences?.set({ show_system: this.showSystem }), !this.showSystem && !re.includes(this.table) && this.changeTable("viewings"), this.requestUpdate();
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
    const e = Object.keys(this.page?.tables ?? ae).filter(
      (i) => this.showSystem || re.includes(i)
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
          ${e.map((i) => a`<button role="tab" id=${`table-${i}`} aria-selected=${this.table === i} tabindex=${this.table === i ? 0 : -1} ?disabled=${this.blocked} @click=${() => this.changeTable(i)}>${ae[i] ?? i}${this.page ? ` (${this.page.tables[i]})` : ""}</button>`)}
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
            <h2>${ae[this.table] ?? this.table}</h2>
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
                    ${(this.page?.references ?? []).filter((i) => Object.values(i.key).every((s) => this.detail?.[s] != null)).map((i) => a`<button class="link" ?disabled=${this.blocked} @click=${() => this.follow(i)}>Open ${ae[i.table] ?? i.table} · ${Object.values(i.key).join(", ")}</button>`)}
                  </div>
                  <pre>${JSON.stringify(this.detail, null, 2)}</pre>
                  ${t ? l : a`<p class="muted">This table protects system integrity; stored values are read-only.</p>`}` : a`<p class="empty">
                  Select an entry to inspect raw values.
                </p>`}
        </section>
      </div>
      <footer class="entries-footer">
        <span
          >${ae[this.table] ?? this.table} · ${this.page?.total ?? 0} total
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
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.operation === "new" ? "New viewing" : "Edit database entry"}
          </h2>
          ${k((i) => this.close(i))}
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
                    @access-denied=${() => this.fail(new b("unauthorized"))}
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
        @click=${C}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            Permanently delete
            ${$(this.selectedRows().length, "entry", "entries")}?
          </h2>
          ${k((i) => this.close(i))}
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
Fe.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, Fe.styles = [q, Kt, Ys];
let Tt = Fe;
customElements.get("kaleidescape-database") || customElements.define("kaleidescape-database", Tt);
function Zs(n, e, t) {
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
const st = [
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
], Be = class Be extends x {
  constructor() {
    super(), this.narrow = !1, this.api = null, this.generation = 0, this.mutationEpoch = 0, this.listRequest = 0, this.detailRequest = 0, this.info = null, this.rows = [], this.selected = null, this.editMovieId = null, this.editTitleTouched = !1, this.draft = null, this.initial = null, this.manual = null, this.manualInitial = "", this.sort = "completed_at", this.descending = !0, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.journalReady = !1, this.sessions = null, this.sessionError = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.nextCursor = null, this.history = [], this.page = 1, this.loading = !1, this.detailLoading = !1, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.error = "", this.lastError = "", this.notice = "", this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = !1, this.maintenanceBusy = !1, this.advancedView = !0, this.modeReady = !1, this.modeScope = "", this.modeError = "", this.controlLocked = !1, Jt(this), ue(this, () => {
      const e = this.renderRoot.querySelector(
        "kaleidescape-reader"
      );
      return !this.info?.permissions.edit || !this.modeReady || this.loading || this.saving || this.pending || this.settingsBusy || this.maintenanceBusy || this.controlLocked || this.dirty() || this.hasOpenDialog() || this.modePreferences?.unsettled || !(e?.confirmNavigation() ?? !0) ? !1 : (this.modePreferences?.dispose(), this.modePreferences = void 0, this.modeReady = !1, this.refresh(), !0);
    });
  }
  modeControl(e = !1) {
    return a`<div class="mode-control" slot="view-mode">
      ${Zs(this.advancedView, e, () => {
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
    (this.advancedView ? !this.discard() : !(e?.confirmNavigation() ?? !0)) || (this.generation++, this.listRequest++, this.detailRequest++, this.closeEditor(), this.rows = [], this.selected = this.sessions = null, this.cursor = void 0, this.history = [], this.nextCursor = null, this.page = 1, this.journalReady = !1, this.error = this.notice = "", i && (this.activePage = $t(
      this.info.ui_defaults?.default_landing_page,
      !1,
      !!this.info.library_enabled,
      !1
    )), I(this.activePage), this.advancedView = t, this.modePreferences?.set({ advanced_view: t }), this.requestUpdate(), t && await this.loadList(), await this.updateComplete, this.renderRoot.querySelector(".view-mode-pill")?.focus());
  }
  willUpdate(e) {
    if (!(!e.has("hass") && !e.has("client")))
      if (this.hass) {
        if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
          this.bind(null);
          return;
        }
        (this.haConnection !== this.hass.connection || this.haUser !== this.hass.user.id) && (this.haConnection = this.hass.connection, this.haUser = this.hass.user.id, this.haClient = new Ft({
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
    this.modePreferences?.dispose(), this.modePreferences = void 0, this.modeScope = this.modeError = "", this.modeReady = this.controlLocked = !1, this.advancedView = !0, this.manual = null, this.manualInitial = "", this.sort = "completed_at", this.descending = !0, this.generation++, this.info = null, this.rows = [], this.selected = null, this.editMovieId = null, this.editTitleTouched = !1, this.draft = null, this.initial = null, this.sessions = null, this.pending = null, this.history = [], this.nextCursor = null, this.cursor = void 0, this.page = 1, this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.confirmDelete = !1, this.saving = !1, this.loading = !1, this.detailLoading = !1, this.sessionError = "", this.notice = "", this.playbackPlayer = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = this.maintenanceBusy = !1, this.fuzzySearch = !0, this.journalView = "list", this.calendarSize = 180, this.calendarFit = !1, this.calendarStatus = void 0, this.journalMovie = void 0, this.libraryTitleId = void 0, this.libraryCriterion = void 0, this.journalReady = !1;
  }
  bind(e) {
    this.api !== e && (this.clearPrivate(), this.api = e, this.error = "", this.requestUpdate(), e && this.refresh());
  }
  fail(e) {
    u(e) === "unauthorized" && this.clearPrivate(), this.lastError = u(e), this.error = w(e), this.requestUpdate();
  }
  dirty() {
    return this.manual ? JSON.stringify(this.manual) !== this.manualInitial : this.draft && (this.editTitleTouched || JSON.stringify(this.draft) !== JSON.stringify(this.initial));
  }
  discard() {
    return (!this.dirty() || window.confirm("Discard your unsaved changes?")) && (this.activePage !== "library" || (this.renderRoot.querySelector("kaleidescape-library")?.confirmNavigation() ?? !0)) && (this.activePage !== "database" || (this.renderRoot.querySelector("kaleidescape-database")?.confirmNavigation() ?? !0)) && (this.activePage !== "settings" || (this.renderRoot.querySelector("kaleidescape-settings")?.confirmNavigation() ?? !0));
  }
  async switchPage(e, t) {
    e === "library" && !this.info?.library_enabled || e === this.activePage && !(e === "journal" && this.journalMovie) || this.loading || this.saving || this.pending || this.maintenanceBusy || this.settingsBusy || this.controlLocked || !this.discard() || (this.closeEditor(), this.libraryTitleId = t?.libraryTitleId, this.libraryCriterion = t?.libraryCriterion, e === "journal" && (this.journalMovie = t?.movie, this.query = this.searchText = "", this.status = this.filterStatus = ""), this.activePage = e, I(e), this.error = this.notice = "", this.requestUpdate(), e === "journal" && (this.page = 1, this.history = [], await this.loadList()));
  }
  pageKey(e) {
    const t = st.filter(
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
      if (!s.length) throw new b("not_ready");
      if (s[0].api_version !== 1) throw new b("not_ready");
      if (this.info = s[0], !this.info.permissions.edit) return;
      const r = `${this.info.entry_id}:${this.info.dataset_id}`;
      if (!this.modePreferences || !this.modeReady || this.modeScope !== r) {
        this.modeReady = !1, this.modePreferences?.dispose();
        const o = new j(
          t,
          this.info,
          !1,
          (h) => {
            this.modePreferences === o && (this.modeError = h ? w(h) : "", this.requestUpdate());
          },
          "interface"
        );
        this.modePreferences = o, this.modeScope = r;
        const d = await o.load();
        if (i !== this.generation) return;
        this.advancedView = d.advanced_view === !0, this.modeReady = !0;
      }
      this.navigationReady || (this.activePage = $t(
        this.info.ui_defaults?.default_landing_page,
        !0,
        !!this.info.library_enabled
      ), this.navigationReady = !0, I(this.activePage)), this.activePage === "library" && !this.info.library_enabled && (this.activePage = "journal", I(this.activePage)), this.history = [], this.cursor = void 0, this.page = 1, this.advancedView && await this.loadList();
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
  async selectRecord(e) {
    if (!this.api || !this.info || this.pending || !this.discard()) return;
    this.closeEditor();
    const t = this.api, i = this.info, s = this.generation, r = ++this.detailRequest;
    this.detailLoading = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const o = await t.get(i, e);
      if (s !== this.generation || r !== this.detailRequest)
        return;
      this.selected = o, this.draft = this.initial = null, this.timingAnchor = void 0, this.detailLoading = !1, this.requestUpdate();
      try {
        const d = await t.sessions(i, e);
        s === this.generation && r === this.detailRequest && (this.sessions = d);
      } catch (d) {
        s === this.generation && r === this.detailRequest && (u(d) === "unauthorized" ? this.fail(d) : this.sessionError = "Session details could not be loaded.");
      }
    } catch (o) {
      s === this.generation && r === this.detailRequest && this.fail(o);
    } finally {
      s === this.generation && r === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  closeEditor() {
    this.timingAnchor = void 0, this.renderRoot.querySelectorAll("dialog").forEach((e) => e.close()), this.manual = null, this.manualInitial = "", this.detailRequest++, this.selected = null, this.editMovieId = null, this.editTitleTouched = !1, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.confirmDelete = !1, this.detailLoading = !1;
  }
  newRecord() {
    this.pending || !this.discard() || (this.closeEditor(), this.draft = yi(), this.initial = { ...this.draft }, this.manual = be(), this.manualInitial = JSON.stringify(this.manual), this.error = "", this.notice = "", this.requestUpdate(), this.updateComplete.then(async () => {
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
    this.draft && (this.draft = Os(
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
        const i = this.manual ? Di(this.manual) : {
          ...Ns(this.draft, this.selected ? this.initial : void 0),
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
        u(i) === "request_id_unavailable" ? this.fail(i) : (this.error = this.manual && i instanceof Error ? i.message : "Check the dates and numeric fields before saving.", this.requestUpdate());
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
        u(r)
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
                @access-denied=${() => this.fail(new b("unauthorized"))}
              ></kaleidescape-manual-viewing>` : Is(
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
                    @access-denied=${() => this.fail(new b("unauthorized"))}
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
  editRecord() {
    !this.selected || this.pending || this.saving || (this.draft = yi(this.selected), this.timingAnchor = {
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
              ${this.sessionError ? a`<p>${this.sessionError}</p>` : this.sessions ? this.sessions.items.length ? a` ${this.sessions.items.map((e) => a`<div class="session">${this.date(e.started_at)}<br />${(e.watched_seconds / 60).toFixed(2)} min watched · ${e.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${$(e.gap_count, "timing gap")}<br />${e.end_reason ?? "Open session"}</div>`)}
                        ${this.sessions.has_more ? a`<small>Showing the latest 100 sessions.</small>` : l}` : a`<p class="muted">
                          No recorded sessions for this entry.
                        </p>` : a`<p class="muted">
                        Session details have not been loaded. Reopen the entry
                        to load them.
                      </p>`}
            </details>` : l}
    `;
  }
  renderJournal() {
    const e = this.loading || this.saving || !!this.pending, t = this.pending && !this.saving ? a`<p class="warning">
              The result is unconfirmed. Retry the same change before making
              another change.
            </p>
            <div class="actions">
              <button @click=${this.commit}>Retry same change</button
              ><button @click=${this.inspectJournal}>
                Discard retry & inspect journal
              </button>
            </div>` : l;
    return a`<section
        class=${`card journal${this.journalView === "calendar" ? " journal-calendar-mode" : ""}`}
        aria-label="Journal"
      >
        <div class="entries-header">
          ${this.journalView === "calendar" ? a`<kaleidescape-journal-shortcuts
                  .context=${this.api}
                  .scopeKey=${`${this.info?.entry_id}:${this.info?.dataset_id}`}
                  .value=${this.searchText}
                  .disabled=${e}
                  .allowAdd=${!0}
                  .filtered=${!!this.status || !!this.journalMovie}
                  .filterLabel=${this.journalMovie ? `Viewings for ${this.journalMovie.title}` : ""}
                  @journal-search=${(i) => {
      this.query = this.searchText = i.detail, this.page = 1, this.history = [], this.loadList();
    }}
                  @journal-clear=${() => {
      this.query = this.searchText = this.status = this.filterStatus = "", this.journalMovie = void 0, this.page = 1, this.history = [], this.loadList();
    }}
                  @journal-add=${this.newRecord}
                  @journal-open-options=${() => this.renderRoot.querySelector("kaleidescape-journal-options")?.open()}
                ></kaleidescape-journal-shortcuts>` : l}
          ${this.journalMovie ? a`<p class="journal-movie-filter">Viewings for ${this.journalMovie.title} <button ?disabled=${e} @click=${() => this.switchPage("journal")}>Show all viewings</button></p>` : l}
          <form
            class="filters journal-filters"
            @submit=${(i) => {
      i.preventDefault(), this.query = this.searchText, this.status = this.filterStatus, this.page = 1, this.history = [], this.loadList();
    }}
          >
            <label
              >Search titles<input
                name="search"
                type="search"
                maxlength="500"
                .value=${this.searchText}
                ?disabled=${e}
                @input=${(i) => {
      this.searchText = i.target.value;
    }}
            /></label>
            <div class="journal-filter-tools">
              <label ?hidden=${this.journalView === "calendar"}
                >Sort by<select
                  name="journal_sort"
                  .value=${this.sort}
                  ?disabled=${e}
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
                ?hidden=${this.journalView === "calendar"}
                ?disabled=${e}
                @click=${() => {
      this.descending = !this.descending, this.page = 1, this.history = [], this.loadList();
    }}
              >
                ${this.descending ? "Descending ↓" : "Ascending ↑"}
              </button>
            </div>
            <button class="journal-search-button" ?disabled=${e}>
              Search
            </button>
            <div class="journal-toolbar">
              <button
                type="button"
                class="primary"
                ?disabled=${e || !this.journalReady}
                @click=${this.newRecord}
              >
                ＋ Add viewing
              </button>
              <button
                type="button"
                ?disabled=${e}
                @click=${() => this.refresh()}
              >
                Refresh
              </button>
              <kaleidescape-journal-options
                .mobileCompact=${this.journalView === "calendar"}
                @journal-refresh=${() => this.refresh()}
                .status=${this.status}
                @journal-status=${(i) => {
      this.status = this.filterStatus = i.detail, this.page = 1, this.history = [], this.loadList(), this.requestUpdate();
    }}
                .client=${this.api}
                .scope=${this.info}
                .disabled=${e}
                @access-denied=${() => this.fail(new b("unauthorized"))}
                @journal-options=${(i) => {
      this.journalReady = !0, this.journalView = i.detail.view, this.calendarSize = i.detail.calendar_size, this.calendarFit = i.detail.calendar_fit;
      const s = this.fuzzySearch !== i.detail.fuzzy_search;
      this.fuzzySearch = i.detail.fuzzy_search, s && (this.history = [], this.page = 1, this.loadList()), this.requestUpdate();
    }}
              ></kaleidescape-journal-options>
            </div>
          </form>
        </div>
        ${this.journalView === "calendar" ? a`<kaleidescape-journal-calendar
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
                .disabled=${e || this.detailLoading}
                .editable=${!0}
                @edit-viewing=${(i) => this.editCalendarViewing(i.detail)}
                @browse-library=${(i) => this.switchPage("library", { libraryCriterion: i.detail })}
                @access-denied=${() => this.fail(new b("unauthorized"))}
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
                              ${this.rows.map((i) => Ei(i, this.selected?.id, (s) => {
      this.selectRecord(s);
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
                      ${this.selected ? a`<button ?disabled=${e} @click=${this.editRecord}>Edit viewing</button><button class="danger" ?disabled=${e} @click=${this.openDelete}>Delete entry</button>` : l}
                    </div>
                    ${this.detailLoading ? a`<div class="empty" role="status">
                            Loading entry…
                          </div>` : this.selected ? a`${Ri(this.selected, (i) => this.date(i))}
                              <kaleidescape-viewing-library
                                .client=${this.api}
                                .scope=${this.info}
                                .viewingId=${this.selected.id}
                                .disabled=${e}
                                @access-denied=${() => this.fail(new b("unauthorized"))}
                                @open-library-title=${(i) => this.switchPage("library", { libraryTitleId: i.detail })}
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
            ${Bt(this.info, this.journalView === "calendar" ? this.calendarStatus : void 0, this.journalView === "calendar")}
            <span class="journal-system-details"
              >· ${this.bytes(this.info?.database_bytes ?? 0)} /
              ${this.bytes(this.info?.database_limit_bytes ?? 0)} database ·
              Recording:
              ${this.info?.tracking_enabled ? "Enabled" : "Manual only"} ·
              ${this.info?.backup_in_progress ? "Backing up" : "Storage ready"}
              · Schema ${this.info?.schema_version} · Revision
              ${this.info?.revision}</span
            > </span
          >${this.journalView === "calendar" ? Vt(this.calendarStatus, () => {
      this.renderRoot.querySelector(
        "kaleidescape-journal-calendar"
      )?.refresh();
    }) : l}

          <div class="pagination" ?hidden=${this.journalView === "calendar"}>
            <small>Page ${this.page} · Up to 25 entries</small>
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
      this.page--, this.loadList(this.history.pop());
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
        </footer>
      </section>
      <dialog
        id="journal-editor"
        data-admin-dialog
        class="database-dialog journal-dialog"
        aria-labelledby="journal-editor-title"
        @click=${C}
        @cancel=${this.cancelEdit}
      >
        <div class="card-head">
          <h2 id="journal-editor-title">
            ${this.manual ? "New viewing" : "Edit viewing"}
          </h2>
          ${k((i) => this.cancelEdit(i))}
        </div>
        ${this.notice ? a`<p class="notice" role="status">${this.notice}</p>` : l}
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}
        ${this.lastError === "conflict" && this.selected ? a`<button @click=${this.reloadSelected}>Reload entry</button>` : l}
        ${this.draft ? t : l}${this.draft ? this.renderEditor() : l}
      </dialog>
      <dialog
        id="journal-delete"
        data-admin-dialog
        class="database-dialog"
        aria-labelledby="journal-delete-title"
        @click=${C}
        @cancel=${this.cancelDelete}
      >
        <div class="card-head">
          <h2 id="journal-delete-title">Remove this entry from the journal?</h2>
          ${k((i) => this.cancelDelete(i))}
        </div>
        <p>${this.selected?.title}</p>
        <p>
          Stored history and backup copies are retained. This does not
          permanently erase the data.
        </p>
        ${this.error ? a`<p class="error" role="alert">${this.error}</p>` : l}${this.confirmDelete ? t : l}
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
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Kaleidescape Companion</h1>
          <p>
            ${st.find((t) => t.id === this.activePage).description}
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
                ${st.map((t) => a`<button id=${`page-${t.id}`} role="tab" aria-selected=${this.activePage === t.id} aria-controls="companion-page" tabindex=${this.activePage === t.id ? "0" : "-1"} ?disabled=${e || t.id === "library" && !this.info?.library_enabled} title=${t.id === "library" && !this.info?.library_enabled ? "Enable library sync in Settings" : l} @click=${() => this.switchPage(t.id)}>${t.label}</button>`)}
              </div>
              ${this.modeControl(e || this.controlLocked)}
            </div>` : l}
      ${this.error ? a`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? a` <button ?disabled=${e} @click=${this.reloadSelected}>Reload entry</button>` : l}</div>` : l}
      ${this.notice ? a`<div class="notice" role="status">${this.notice}</div>` : l}
      ${this.api ? this.info ? a`<section
                id="companion-page"
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
                        .openTitleId=${this.libraryTitleId}
                        .openCriterion=${this.libraryCriterion}
                        @open-title-journal=${(t) => this.switchPage("journal", { movie: t.detail })}
                        @access-denied=${() => this.fail(new b("unauthorized"))}
                        @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
                      ></kaleidescape-library>` : this.activePage === "database" ? a`<kaleidescape-database
                          .client=${this.api}
                          .scope=${this.info}
                          @access-denied=${() => this.fail(new b("unauthorized"))}
                          @maintenance-busy=${(t) => {
      this.maintenanceBusy !== t.detail && (this.maintenanceBusy = t.detail, this.requestUpdate());
    }}
                          @database-changed=${() => this.refreshInfo()}
                        ></kaleidescape-database>` : this.activePage === "settings" ? a`<kaleidescape-settings
                            .client=${this.api}
                            .scope=${this.info}
                            @access-denied=${() => this.fail(new b("unauthorized"))}
                            @settings-busy=${(t) => {
      this.settingsBusy !== t.detail && (this.settingsBusy = t.detail, this.requestUpdate());
    }}
                            @settings-saved=${() => {
      this.activePage = "settings", I("settings"), this.notice = "Settings saved. Reloading the integration…";
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
    </main>`;
  }
};
Be.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, Be.styles = [q, Kt, zi];
let At = Be;
customElements.get("kaleidescape-panel") || customElements.define("kaleidescape-panel", At);
export {
  At as KaleidescapePanel
};
