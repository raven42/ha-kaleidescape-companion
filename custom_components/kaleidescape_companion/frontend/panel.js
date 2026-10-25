const D = globalThis, W = D.ShadowRoot && (D.ShadyCSS === void 0 || D.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, J = /* @__PURE__ */ Symbol(), Y = /* @__PURE__ */ new WeakMap();
let ot = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== J) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (W && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = Y.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && Y.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const ut = (r) => new ot(typeof r == "string" ? r : r + "", void 0, J), ft = (r, ...t) => {
  const e = r.length === 1 ? r[0] : t.reduce((i, s, n) => i + ((a) => {
    if (a._$cssResult$ === !0) return a.cssText;
    if (typeof a == "number") return a;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + a + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + r[n + 1], r[0]);
  return new ot(e, r, J);
}, gt = (r, t) => {
  if (W) r.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = D.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, r.appendChild(i);
  }
}, Z = W ? (r) => r : (r) => r instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return ut(e);
})(r) : r;
const { is: mt, defineProperty: $t, getOwnPropertyDescriptor: vt, getOwnPropertyNames: bt, getOwnPropertySymbols: yt, getPrototypeOf: _t } = Object, j = globalThis, Q = j.trustedTypes, xt = Q ? Q.emptyScript : "", wt = j.reactiveElementPolyfillSupport, R = (r, t) => r, I = { toAttribute(r, t) {
  switch (t) {
    case Boolean:
      r = r ? xt : null;
      break;
    case Object:
    case Array:
      r = r == null ? r : JSON.stringify(r);
  }
  return r;
}, fromAttribute(r, t) {
  let e = r;
  switch (t) {
    case Boolean:
      e = r !== null;
      break;
    case Number:
      e = r === null ? null : Number(r);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(r);
      } catch {
        e = null;
      }
  }
  return e;
} }, lt = (r, t) => !mt(r, t), X = { attribute: !0, type: String, converter: I, reflect: !1, useDefault: !1, hasChanged: lt };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), j.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let _ = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = X) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = /* @__PURE__ */ Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && $t(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: n } = vt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(a) {
      this[e] = a;
    } };
    return { get: s, set(a) {
      const h = s?.call(this);
      n?.call(this, a), this.requestUpdate(t, h, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? X;
  }
  static _$Ei() {
    if (this.hasOwnProperty(R("elementProperties"))) return;
    const t = _t(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(R("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(R("properties"))) {
      const e = this.properties, i = [...bt(e), ...yt(e)];
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
      for (const s of i) e.unshift(Z(s));
    } else t !== void 0 && e.push(Z(t));
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
    return gt(t, this.constructor.elementStyles), t;
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
      const n = (i.converter?.toAttribute !== void 0 ? i.converter : I).toAttribute(e, i.type);
      this._$Em = t, n == null ? this.removeAttribute(s) : this.setAttribute(s, n), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const n = i.getPropertyOptions(s), a = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : I;
      this._$Em = s;
      const h = a.fromAttribute(e, n.type);
      this[s] = h ?? this._$Ej?.get(s) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, n) {
    if (t !== void 0) {
      const a = this.constructor;
      if (s === !1 && (n = this[t]), i ??= a.getPropertyOptions(t), !((i.hasChanged ?? lt)(n, e) || i.useDefault && i.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(a._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: n }, a) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, a ?? e ?? this[t]), n !== !0 || a !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
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
        for (const [s, n] of this._$Ep) this[s] = n;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, n] of i) {
        const { wrapped: a } = n, h = this[s];
        a !== !0 || this._$AL.has(s) || h === void 0 || this.C(s, void 0, n, h);
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
_.elementStyles = [], _.shadowRootOptions = { mode: "open" }, _[R("elementProperties")] = /* @__PURE__ */ new Map(), _[R("finalized")] = /* @__PURE__ */ new Map(), wt?.({ ReactiveElement: _ }), (j.reactiveElementVersions ??= []).push("2.1.2");
const V = globalThis, G = (r) => r, z = V.trustedTypes, tt = z ? z.createPolicy("lit-html", { createHTML: (r) => r }) : void 0, ht = "$lit$", m = `lit$${Math.random().toFixed(9).slice(2)}$`, dt = "?" + m, At = `<${dt}>`, b = document, U = () => b.createComment(""), T = (r) => r === null || typeof r != "object" && typeof r != "function", F = Array.isArray, Et = (r) => F(r) || typeof r?.[Symbol.iterator] == "function", M = `[ 	
\f\r]`, E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, et = /-->/g, it = />/g, $ = RegExp(`>|${M}(?:([^\\s"'>=/]+)(${M}*=${M}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), st = /'/g, rt = /"/g, ct = /^(?:script|style|textarea|title)$/i, St = (r) => (t, ...e) => ({ _$litType$: r, strings: t, values: e }), d = St(1), w = /* @__PURE__ */ Symbol.for("lit-noChange"), l = /* @__PURE__ */ Symbol.for("lit-nothing"), nt = /* @__PURE__ */ new WeakMap(), v = b.createTreeWalker(b, 129);
function pt(r, t) {
  if (!F(r) || !r.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return tt !== void 0 ? tt.createHTML(t) : t;
}
const Ct = (r, t) => {
  const e = r.length - 1, i = [];
  let s, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", a = E;
  for (let h = 0; h < e; h++) {
    const o = r[h];
    let c, u, p = -1, f = 0;
    for (; f < o.length && (a.lastIndex = f, u = a.exec(o), u !== null); ) f = a.lastIndex, a === E ? u[1] === "!--" ? a = et : u[1] !== void 0 ? a = it : u[2] !== void 0 ? (ct.test(u[2]) && (s = RegExp("</" + u[2], "g")), a = $) : u[3] !== void 0 && (a = $) : a === $ ? u[0] === ">" ? (a = s ?? E, p = -1) : u[1] === void 0 ? p = -2 : (p = a.lastIndex - u[2].length, c = u[1], a = u[3] === void 0 ? $ : u[3] === '"' ? rt : st) : a === rt || a === st ? a = $ : a === et || a === it ? a = E : (a = $, s = void 0);
    const g = a === $ && r[h + 1].startsWith("/>") ? " " : "";
    n += a === E ? o + At : p >= 0 ? (i.push(c), o.slice(0, p) + ht + o.slice(p) + m + g) : o + m + (p === -2 ? h : g);
  }
  return [pt(r, n + (r[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class q {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let n = 0, a = 0;
    const h = t.length - 1, o = this.parts, [c, u] = Ct(t, e);
    if (this.el = q.createElement(c, i), v.currentNode = this.el.content, e === 2 || e === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = v.nextNode()) !== null && o.length < h; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(ht)) {
          const f = u[a++], g = s.getAttribute(p).split(m), P = /([.?@])?(.*)/.exec(f);
          o.push({ type: 1, index: n, name: P[2], strings: g, ctor: P[1] === "." ? kt : P[1] === "?" ? Ut : P[1] === "@" ? Tt : L }), s.removeAttribute(p);
        } else p.startsWith(m) && (o.push({ type: 6, index: n }), s.removeAttribute(p));
        if (ct.test(s.tagName)) {
          const p = s.textContent.split(m), f = p.length - 1;
          if (f > 0) {
            s.textContent = z ? z.emptyScript : "";
            for (let g = 0; g < f; g++) s.append(p[g], U()), v.nextNode(), o.push({ type: 2, index: ++n });
            s.append(p[f], U());
          }
        }
      } else if (s.nodeType === 8) if (s.data === dt) o.push({ type: 2, index: n });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(m, p + 1)) !== -1; ) o.push({ type: 7, index: n }), p += m.length - 1;
      }
      n++;
    }
  }
  static createElement(t, e) {
    const i = b.createElement("template");
    return i.innerHTML = t, i;
  }
}
function A(r, t, e = r, i) {
  if (t === w) return t;
  let s = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const n = T(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== n && (s?._$AO?.(!1), n === void 0 ? s = void 0 : (s = new n(r), s._$AT(r, e, i)), i !== void 0 ? (e._$Co ??= [])[i] = s : e._$Cl = s), s !== void 0 && (t = A(r, s._$AS(r, t.values), s, i)), t;
}
class Rt {
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
    const { el: { content: e }, parts: i } = this._$AD, s = (t?.creationScope ?? b).importNode(e, !0);
    v.currentNode = s;
    let n = v.nextNode(), a = 0, h = 0, o = i[0];
    for (; o !== void 0; ) {
      if (a === o.index) {
        let c;
        o.type === 2 ? c = new O(n, n.nextSibling, this, t) : o.type === 1 ? c = new o.ctor(n, o.name, o.strings, this, t) : o.type === 6 && (c = new qt(n, this, t)), this._$AV.push(c), o = i[++h];
      }
      a !== o?.index && (n = v.nextNode(), a++);
    }
    return v.currentNode = b, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class O {
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
    t = A(this, t, e), T(t) ? t === l || t == null || t === "" ? (this._$AH !== l && this._$AR(), this._$AH = l) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Et(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== l && T(this._$AH) ? this._$AA.nextSibling.data = t : this.T(b.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = q.createElement(pt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const n = new Rt(s, this), a = n.u(this.options);
      n.p(e), this.T(a), this._$AH = n;
    }
  }
  _$AC(t) {
    let e = nt.get(t.strings);
    return e === void 0 && nt.set(t.strings, e = new q(t)), e;
  }
  k(t) {
    F(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const n of t) s === e.length ? e.push(i = new O(this.O(U()), this.O(U()), this, this.options)) : i = e[s], i._$AI(n), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = G(t).nextSibling;
      G(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class L {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, n) {
    this.type = 1, this._$AH = l, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = n, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = l;
  }
  _$AI(t, e = this, i, s) {
    const n = this.strings;
    let a = !1;
    if (n === void 0) t = A(this, t, e, 0), a = !T(t) || t !== this._$AH && t !== w, a && (this._$AH = t);
    else {
      const h = t;
      let o, c;
      for (t = n[0], o = 0; o < n.length - 1; o++) c = A(this, h[i + o], e, o), c === w && (c = this._$AH[o]), a ||= !T(c) || c !== this._$AH[o], c === l ? t = l : t !== l && (t += (c ?? "") + n[o + 1]), this._$AH[o] = c;
    }
    a && !s && this.j(t);
  }
  j(t) {
    t === l ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class kt extends L {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === l ? void 0 : t;
  }
}
class Ut extends L {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== l);
  }
}
class Tt extends L {
  constructor(t, e, i, s, n) {
    super(t, e, i, s, n), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = A(this, t, e, 0) ?? l) === w) return;
    const i = this._$AH, s = t === l && i !== l || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, n = t !== l && (i === l || s);
    s && this.element.removeEventListener(this.name, this, i), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class qt {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    A(this, t);
  }
}
const Ot = V.litHtmlPolyfillSupport;
Ot?.(q, O), (V.litHtmlVersions ??= []).push("3.3.3");
const Pt = (r, t, e) => {
  const i = e?.renderBefore ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const n = e?.renderBefore ?? null;
    i._$litPart$ = s = new O(t.insertBefore(U(), n), n, void 0, e ?? {});
  }
  return s._$AI(r), s;
};
const K = globalThis;
class k extends _ {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Pt(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return w;
  }
}
k._$litElement$ = !0, k.finalized = !0, K.litElementHydrateSupport?.({ LitElement: k });
const Dt = K.litElementPolyfillSupport;
Dt?.({ LitElement: k });
(K.litElementVersions ??= []).push("4.2.2");
class x extends Error {
  constructor(t) {
    super(t), this.code = t;
  }
}
const y = "kaleidescape_companion", zt = 15e3, S = ({ entry_id: r, dataset_id: t }) => ({
  entry_id: r,
  dataset_id: t
}), Nt = 256 * 1024 * 1024;
function C(r) {
  return typeof r == "object" && r !== null && "code" in r && typeof r.code == "string" ? r.code : "connection_lost";
}
function jt(r) {
  return {
    unauthorized: "Administrator access is required. Your journal has been cleared from this view.",
    not_ready: "The integration is not loaded. Reload the connection after it starts.",
    not_found: "This record or dataset is no longer available. Refresh the journal.",
    conflict: "This entry changed elsewhere. Reload the entry and review your changes before saving again.",
    refresh_required: "The journal changed. Return to the first page to refresh the results.",
    invalid_request: "Some values were rejected. Check the fields and try again.",
    busy: "The journal is busy. Wait a moment, then retry.",
    backup_in_progress: "A backup is running. Retry after it finishes.",
    storage_error: "The journal could not access storage. Check HA diagnostics and available space.",
    export_too_large: "This export exceeds the download size limit.",
    export_timeout: "The export timed out. Try again when the server is less busy."
  }[C(r)] ?? "The connection was interrupted. The result could not be confirmed.";
}
async function Lt(r) {
  let t;
  try {
    return await Promise.race([
      r,
      new Promise((e, i) => {
        t = setTimeout(
          () => i(new x("connection_lost")),
          zt
        );
      })
    ]);
  } finally {
    clearTimeout(t);
  }
}
class Mt {
  constructor(t) {
    this.transport = t;
  }
  call(t) {
    return Lt(this.transport.callWS(t));
  }
  info() {
    return this.call({ type: `${y}/info` });
  }
  list(t, e = "", i = "", s) {
    return this.call({
      type: `${y}/journal/list`,
      ...S(t),
      query: e,
      limit: 25,
      ...i ? { status: i } : {},
      ...s ? { cursor: s } : {}
    });
  }
  get(t, e) {
    return this.call({
      type: `${y}/journal/get`,
      ...S(t),
      viewing_id: e
    });
  }
  sessions(t, e) {
    return this.call({
      type: `${y}/journal/sessions`,
      ...S(t),
      viewing_id: e
    });
  }
  prepare(t, e, i) {
    const s = structuredClone({
      ...i,
      ...S(t),
      type: `${y}/journal/${e}`,
      request_id: crypto.randomUUID()
    });
    return { scope: S(t), message: Object.freeze(s) };
  }
  mutate(t) {
    return this.call({ ...t.message });
  }
  async download(t, e, i) {
    const s = `/api/${y}/${encodeURIComponent(t.entry_id)}/${encodeURIComponent(t.dataset_id)}/export?format=${e}`, n = await this.transport.fetchWithAuth(s, {
      signal: i,
      cache: "no-store",
      redirect: "error"
    });
    if (!n.ok) {
      const c = {
        401: "unauthorized",
        403: "unauthorized",
        404: "not_found",
        413: "export_too_large",
        503: "busy"
      };
      throw new x(c[n.status] ?? "storage_error");
    }
    const a = n.body?.getReader();
    if (!a) throw new x("storage_error");
    const h = [];
    let o = 0;
    try {
      for (; ; ) {
        const { value: c, done: u } = await a.read();
        if (u) break;
        if (o += c.byteLength, o > Nt) throw new x("export_too_large");
        h.push(new Uint8Array(c));
      }
      return new Blob(h, {
        type: e === "json" ? "application/json" : "application/vnd.sqlite3"
      });
    } finally {
      await a.cancel().catch(() => {
      }), a.releaseLock();
    }
  }
}
function at(r) {
  const t = new Date(r);
  return new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 23);
}
function H(r) {
  return {
    title: r?.title ?? "",
    started_at: at(r?.started_at ?? (/* @__PURE__ */ new Date()).toISOString()),
    ended_at: r?.ended_at ? at(r.ended_at) : "",
    duration_seconds: r?.duration_seconds == null ? "" : String(r.duration_seconds / 60),
    watched_seconds: String((r?.watched_seconds ?? 0) / 60),
    status: r?.status ?? "partial",
    notes: r?.notes ?? "",
    source_id: r?.source_id ?? "",
    player_id: r?.player_id ?? "",
    raw_content_id: r?.raw_content_id ?? ""
  };
}
function Ht(r, t) {
  const e = {};
  for (const [i, s] of Object.entries(r))
    t && s === t[i] || (i === "started_at" || i === "ended_at" ? e[i] = s ? new Date(s).toISOString() : null : i === "duration_seconds" || i === "watched_seconds" ? e[i] = s === "" ? null : Number(s) * 60 : ["source_id", "player_id", "raw_content_id"].includes(i) ? e[i] = s === "" ? null : s : e[i] = s);
  return e;
}
const It = ft`
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
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
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
  .exports {
    margin-top: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .exports small {
    flex: 1;
    min-width: 180px;
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
  [hidden] {
    display: none !important;
  }
  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
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
      grid-template-columns: 1fr;
    }
    .card-head,
    .editor {
      padding-left: 16px;
      padding-right: 16px;
    }
  }
`, N = class N extends k {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.generation = 0, this.listRequest = 0, this.detailRequest = 0, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.nextCursor = null, this.history = [], this.page = 1, this.loading = !1, this.detailLoading = !1, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.exporting = !1, this.error = "", this.lastError = "", this.notice = "";
  }
  willUpdate(t) {
    if (!(!t.has("hass") && !t.has("client")))
      if (this.hass) {
        if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
          this.bind(null);
          return;
        }
        (this.haConnection !== this.hass.connection || this.haUser !== this.hass.user.id) && (this.haConnection = this.hass.connection, this.haUser = this.hass.user.id, this.haClient = new Mt({
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
    this.generation++, this.exportAbort?.abort(), this.exportAbort = void 0, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.pending = null, this.history = [], this.nextCursor = null, this.cursor = void 0, this.page = 1, this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.confirmDelete = !1, this.saving = !1, this.loading = !1, this.detailLoading = !1, this.exporting = !1, this.sessionError = "", this.notice = "";
  }
  bind(t) {
    this.api !== t && (this.clearPrivate(), this.api = t, this.error = "", this.requestUpdate(), t && this.refresh());
  }
  fail(t) {
    C(t) === "unauthorized" && this.clearPrivate(), this.lastError = C(t), this.error = jt(t), this.requestUpdate();
  }
  dirty() {
    return this.draft && JSON.stringify(this.draft) !== JSON.stringify(this.initial);
  }
  discard() {
    return !this.dirty() || window.confirm("Discard your unsaved changes?");
  }
  async refresh() {
    if (!this.api || this.pending || !this.discard()) return;
    const t = this.api, e = ++this.generation;
    this.exportAbort?.abort(), this.exporting = !1, this.info = null, this.rows = [], this.closeEditor(), this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const { entries: i } = await t.info();
      if (e !== this.generation) return;
      if (!i.length) throw new x("not_ready");
      if (i[0].api_version !== 1) throw new x("not_ready");
      this.info = i[0], this.history = [], this.cursor = void 0, this.page = 1, await this.loadList();
    } catch (i) {
      e === this.generation && this.fail(i);
    } finally {
      e === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async loadList(t) {
    if (!this.api || !this.info) return;
    const e = this.api, i = this.info, s = this.generation, n = ++this.listRequest;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const a = await e.list(i, this.query, this.status, t);
      if (s !== this.generation || n !== this.listRequest)
        return;
      this.rows = a.items, this.cursor = t, this.nextCursor = a.next_cursor, this.info = { ...this.info, revision: a.revision };
    } catch (a) {
      s === this.generation && n === this.listRequest && (this.rows = [], this.nextCursor = null, this.fail(a));
    } finally {
      s === this.generation && n === this.listRequest && (this.loading = !1, this.requestUpdate());
    }
  }
  async selectRecord(t) {
    if (!this.api || !this.info || this.pending || !this.discard()) return;
    this.closeEditor();
    const e = this.api, i = this.info, s = this.generation, n = ++this.detailRequest;
    this.detailLoading = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const a = await e.get(i, t);
      if (s !== this.generation || n !== this.detailRequest)
        return;
      this.selected = a, this.draft = H(a), this.initial = { ...this.draft }, this.detailLoading = !1, this.requestUpdate();
      try {
        const h = await e.sessions(i, t);
        s === this.generation && n === this.detailRequest && (this.sessions = h);
      } catch (h) {
        s === this.generation && n === this.detailRequest && (C(h) === "unauthorized" ? this.fail(h) : this.sessionError = "Session details could not be loaded.");
      }
    } catch (a) {
      s === this.generation && n === this.detailRequest && this.fail(a);
    } finally {
      s === this.generation && n === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  closeEditor() {
    this.detailRequest++, this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.confirmDelete = !1, this.detailLoading = !1;
  }
  newRecord() {
    this.pending || !this.discard() || (this.closeEditor(), this.draft = H(), this.initial = { ...this.draft }, this.error = "", this.notice = "", this.requestUpdate(), this.updateComplete.then(
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
        const i = Ht(
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
      } catch {
        this.error = "Check the dates and numeric fields before saving.", this.requestUpdate();
      }
  }
  async deleteRecord() {
    !this.api || !this.info || !this.selected || this.pending || (this.pending = this.api.prepare(this.info, "delete", {
      viewing_id: this.selected.id,
      expected_revision: this.selected.revision
    }), this.confirmDelete = !1, await this.commit());
  }
  async commit() {
    if (!this.api || !this.pending || this.saving) return;
    const t = this.api, e = this.pending, i = this.generation;
    this.saving = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const s = await t.mutate(e);
      if (i !== this.generation) return;
      this.pending = null, this.closeEditor(), this.notice = s.viewing.deleted_at ? "Entry removed from the journal. Stored history is retained." : "Entry saved.", s.viewing.deleted_at || (this.selected = s.viewing, this.draft = H(s.viewing), this.initial = { ...this.draft }), this.page = 1, this.history = [], await this.loadList();
      try {
        const { entries: n } = await t.info();
        i === this.generation && n[0]?.dataset_id === this.info?.dataset_id && (this.info = n[0]);
      } catch (n) {
        i === this.generation && this.fail(n);
      }
    } catch (s) {
      if (i !== this.generation) return;
      ["invalid_request", "conflict", "unauthorized"].includes(
        C(s)
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
  async exportData(t) {
    if (!this.api || !this.info || this.exporting) return;
    const e = this.api, i = this.info, s = this.generation, n = this.exportAbort = new AbortController(), a = setTimeout(() => n.abort(), 65e3);
    this.exporting = !0, this.error = "", this.requestUpdate();
    try {
      const h = await e.download(i, t, n.signal);
      if (s !== this.generation) return;
      const o = URL.createObjectURL(h), c = document.createElement("a");
      try {
        c.href = o, c.download = `kaleidescape-journal.${t}`, c.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(o), 1e3);
      }
      this.notice = "Export downloaded. Keep this private copy in a protected location.";
    } catch (h) {
      s === this.generation && this.fail(h);
    } finally {
      clearTimeout(a), s === this.generation && (this.exporting = !1, this.exportAbort = void 0, this.requestUpdate());
    }
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
  field(t, e, i = "text", s = !1, n) {
    return d`<label
      >${e}<input
        id=${t === "title" ? "title" : t}
        name=${t}
        type=${i}
        .value=${this.draft[t]}
        ?required=${s}
        maxlength=${n ?? l}
        min=${i === "number" ? "0" : l}
        max=${i === "number" ? String(1e9 / 60) : l}
        step=${i === "datetime-local" ? "0.001" : "any"}
        @input=${(a) => this.input(t, a)}
    /></label>`;
  }
  renderEditor() {
    return this.detailLoading ? d`<div class="empty" role="status">Loading entry…</div>` : this.draft ? d`<form class="editor" @submit=${this.save}>
      <fieldset ?disabled=${this.saving || !!this.pending}>
        <div class="grid">
          <div class="full">
            ${this.field("title", "Title", "text", !0, 500)}
          </div>
          ${this.field("started_at", "Started · local time", "datetime-local", !0)}
          ${this.field("ended_at", "Ended · local time", "datetime-local")}
          ${this.field("watched_seconds", "Watched minutes", "number", !0)}
          ${this.field("duration_seconds", "Runtime minutes · optional", "number")}
          <label
            >Status<select
              name="record_status"
              .value=${this.draft.status}
              @change=${(t) => this.input("status", t)}
            >
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
            </select></label
          >
          <label class="full"
            >Notes<textarea
              name="notes"
              maxlength="10000"
              .value=${this.draft.notes}
              @input=${(t) => this.input("notes", t)}
            ></textarea>
          </label>
        </div>
        ${this.selected?.origin === "observed" ? d`<small>Only fields you change are marked as manual corrections. Session evidence is retained.</small>` : l}
        <details>
          <summary>Source identifiers</summary>
          <div class="grid">
            ${this.field("source_id", "Source ID", "text", !1, 255)}
            ${this.field("player_id", "Player ID", "text", !1, 255)}
            <div class="full">
              ${this.field("raw_content_id", "Raw content ID", "text", !1, 255)}
            </div>
          </div>
          <small
            >Keep source identifiers exact. Titles do not establish movie
            identity.</small
          >
        </details>
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
          ${this.selected ? d`<span class="grow"></span
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
      ${this.confirmDelete ? d`<div class="warning">
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
      ${this.selected ? d`<details>
              <summary>Record details & sessions</summary>
              <div class="metadata">
                Record ${this.selected.id}<br />Origin: ${this.selected.origin}
                · Revision ${this.selected.revision}<br />Updated
                ${this.date(this.selected.updated_at)}<br />Completion:
                ${this.selected.completion_reason ?? "Not completed"}
              </div>
              ${this.sessionError ? d`<p>${this.sessionError}</p>` : this.sessions ? this.sessions.items.length ? d` ${this.sessions.items.map((t) => d`<div class="session">${this.date(t.started_at)}<br />${(t.watched_seconds / 60).toFixed(1)} min watched · ${t.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${t.gap_count} timing gaps<br />${t.end_reason ?? "Open session"}</div>`)}
                        ${this.sessions.has_more ? d`<small>Showing the latest 100 sessions.</small>` : l}` : d`<p class="muted">
                          No recorded sessions for this entry.
                        </p>` : d`<p class="muted">
                        Session details have not been loaded. Reopen the entry
                        to load them.
                      </p>`}
            </details>` : l}
    </form>` : d`<div class="empty">
        <strong>Select an entry</strong>
        <p>Review its details, make corrections, or add a manual viewing.</p>
      </div>`;
  }
  render() {
    const t = this.loading || this.saving || !!this.pending;
    return d`<main>
      <header>
        ${this.hass && this.narrow ? d`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : l}
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Journal management</h1>
          <p>Review recordings and make corrections.</p>
        </div>
        <button
          class="primary"
          ?disabled=${!this.info || t}
          @click=${this.newRecord}
        >
          ＋ Add viewing
        </button>
      </header>
      ${this.error ? d`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? d` <button ?disabled=${t} @click=${() => this.selectRecord(this.selected.id)}>Reload entry</button>` : l}</div>` : l}
      ${this.notice ? d`<div class="notice" role="status">${this.notice}</div>` : l}
      ${this.pending && !this.saving ? d`<div class="warning">
              Retry the same change to confirm its result. The form is locked to
              prevent duplicate writes.
              <div class="actions">
                <button @click=${this.commit}>Retry same change</button>
                <button @click=${this.inspectJournal}>
                  Discard retry & inspect journal
                </button>
              </div>
            </div>` : l}
      ${this.api ? this.info ? d`
                <section class="metrics" aria-label="Database overview">
                  <div class="metric">
                    <small>Journal entries</small
                    ><strong>${this.info.viewing_count}</strong>
                  </div>
                  <div class="metric">
                    <small>Database size</small
                    ><strong>${this.bytes(this.info.database_bytes)}</strong
                    ><small
                      >of ${this.bytes(this.info.database_limit_bytes)}</small
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
                      >Schema ${this.info.schema_version} · Revision
                      ${this.info.revision}</small
                    >
                  </div>
                </section>
                <div class="layout">
                  <section class="card" aria-label="Journal entries">
                    <div class="card-head">
                      <h2>Viewings</h2>
                      <button ?disabled=${t} @click=${this.refresh}>
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
                          <option value="completed">Completed</option>
                        </select></label
                      >
                      <button ?disabled=${t}>Search</button>
                    </form>
                    ${this.loading ? d`<div class="empty" role="status">
                            Loading viewings…
                          </div>` : this.rows.length ? d`<div class="table-wrap">
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
      (e) => d` <tr
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
                                            >${this.date(e.started_at)} ·
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
                                          ${(e.watched_seconds / 60).toFixed(1)}
                                          min
                                        </td>
                                      </tr>`
    )}
                                </tbody>
                              </table>
                            </div>` : d`<div class="empty">
                              <strong
                                >${this.query || this.status ? "No matching viewings" : "Your journal is empty"}</strong
                              >
                              <p>
                                ${this.query || this.status ? "Try another title or status." : "Add a manual viewing or enable automatic tracking in the integration settings."}
                              </p>
                            </div>`}
                    <div class="pagination">
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
                  </section>
                  <section class="card" aria-label="Viewing editor">
                    <div class="card-head">
                      <h2>
                        ${this.selected ? "Edit viewing" : this.draft ? "New viewing" : "Viewing details"}
                      </h2>
                      ${this.dirty() ? d`<span class="badge">Unsaved</span>` : l}
                    </div>
                    ${this.renderEditor()}
                  </section>
                </div>
                <footer class="exports">
                  <small
                    >Exports include private history and deleted records. Store
                    downloads securely.</small
                  >
                  <button
                    ?disabled=${this.exporting || t}
                    @click=${() => this.exportData("json")}
                  >
                    ${this.exporting ? "Exporting…" : "Export JSON"}
                  </button>
                  <button
                    ?disabled=${this.exporting || t}
                    @click=${() => this.exportData("sqlite")}
                  >
                    Export SQLite
                  </button>
                </footer>
              ` : d`<div class="empty" role="status">
                <strong
                  >${this.loading ? "Connecting to the journal…" : "Journal unavailable"}</strong
                >${this.loading ? l : d`<button @click=${this.refresh}>Reload connection</button>`}
              </div>` : d`<div class="empty">
              <strong>Connect through Home Assistant</strong>
              <p>
                Open Kaleidescape Companion in HA with an administrator account,
                or connect the local development preview.
              </p>
            </div>`}
    </main>`;
  }
};
N.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, N.styles = It;
let B = N;
customElements.get("kaleidescape-panel") || customElements.define("kaleidescape-panel", B);
export {
  B as KaleidescapePanel
};
