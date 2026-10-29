const I = globalThis, vt = I.ShadowRoot && (I.ShadyCSS === void 0 || I.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, yt = /* @__PURE__ */ Symbol(), kt = /* @__PURE__ */ new WeakMap();
let Mt = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== yt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (vt && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = kt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && kt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Zt = (o) => new Mt(typeof o == "string" ? o : o + "", void 0, yt), Z = (o, ...t) => {
  const e = o.length === 1 ? o[0] : t.reduce((i, s, a) => i + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + o[a + 1], o[0]);
  return new Mt(e, o, yt);
}, te = (o, t) => {
  if (vt) o.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = I.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, o.appendChild(i);
  }
}, xt = vt ? (o) => o : (o) => o instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return Zt(e);
})(o) : o;
const { is: ee, defineProperty: ie, getOwnPropertyDescriptor: se, getOwnPropertyNames: ae, getOwnPropertySymbols: re, getPrototypeOf: ne } = Object, tt = globalThis, Ct = tt.trustedTypes, oe = Ct ? Ct.emptyScript : "", le = tt.reactiveElementPolyfillSupport, T = (o, t) => o, ot = { toAttribute(o, t) {
  switch (t) {
    case Boolean:
      o = o ? oe : null;
      break;
    case Object:
    case Array:
      o = o == null ? o : JSON.stringify(o);
  }
  return o;
}, fromAttribute(o, t) {
  let e = o;
  switch (t) {
    case Boolean:
      e = o !== null;
      break;
    case Number:
      e = o === null ? null : Number(o);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(o);
      } catch {
        e = null;
      }
  }
  return e;
} }, It = (o, t) => !ee(o, t), St = { attribute: !0, type: String, converter: ot, reflect: !1, useDefault: !1, hasChanged: It };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), tt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let E = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = St) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = /* @__PURE__ */ Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && ie(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: a } = se(this.prototype, t) ?? { get() {
      return this[e];
    }, set(n) {
      this[e] = n;
    } };
    return { get: s, set(n) {
      const d = s?.call(this);
      a?.call(this, n), this.requestUpdate(t, d, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? St;
  }
  static _$Ei() {
    if (this.hasOwnProperty(T("elementProperties"))) return;
    const t = ne(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(T("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(T("properties"))) {
      const e = this.properties, i = [...ae(e), ...re(e)];
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
      for (const s of i) e.unshift(xt(s));
    } else t !== void 0 && e.push(xt(t));
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
    return te(t, this.constructor.elementStyles), t;
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
      const a = (i.converter?.toAttribute !== void 0 ? i.converter : ot).toAttribute(e, i.type);
      this._$Em = t, a == null ? this.removeAttribute(s) : this.setAttribute(s, a), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const a = i.getPropertyOptions(s), n = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : ot;
      this._$Em = s;
      const d = n.fromAttribute(e, a.type);
      this[s] = d ?? this._$Ej?.get(s) ?? d, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, a) {
    if (t !== void 0) {
      const n = this.constructor;
      if (s === !1 && (a = this[t]), i ??= n.getPropertyOptions(t), !((i.hasChanged ?? It)(a, e) || i.useDefault && i.reflect && a === this._$Ej?.get(t) && !this.hasAttribute(n._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: a }, n) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, n ?? e ?? this[t]), a !== !0 || n !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
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
        const { wrapped: n } = a, d = this[s];
        n !== !0 || this._$AL.has(s) || d === void 0 || this.C(s, void 0, a, d);
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
E.elementStyles = [], E.shadowRootOptions = { mode: "open" }, E[T("elementProperties")] = /* @__PURE__ */ new Map(), E[T("finalized")] = /* @__PURE__ */ new Map(), le?.({ ReactiveElement: E }), (tt.reactiveElementVersions ??= []).push("2.1.2");
const $t = globalThis, qt = (o) => o, B = $t.trustedTypes, Et = B ? B.createPolicy("lit-html", { createHTML: (o) => o }) : void 0, Bt = "$lit$", x = `lit$${Math.random().toFixed(9).slice(2)}$`, Ht = "?" + x, he = `<${Ht}>`, q = document, z = () => q.createComment(""), N = (o) => o === null || typeof o != "object" && typeof o != "function", wt = Array.isArray, de = (o) => wt(o) || typeof o?.[Symbol.iterator] == "function", it = `[ 	
\f\r]`, P = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Ut = /-->/g, At = />/g, C = RegExp(`>|${it}(?:([^\\s"'>=/]+)(${it}*=${it}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Rt = /'/g, Pt = /"/g, Ft = /^(?:script|style|textarea|title)$/i, ce = (o) => (t, ...e) => ({ _$litType$: o, strings: t, values: e }), r = ce(1), U = /* @__PURE__ */ Symbol.for("lit-noChange"), h = /* @__PURE__ */ Symbol.for("lit-nothing"), Tt = /* @__PURE__ */ new WeakMap(), S = q.createTreeWalker(q, 129);
function Vt(o, t) {
  if (!wt(o) || !o.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Et !== void 0 ? Et.createHTML(t) : t;
}
const ue = (o, t) => {
  const e = o.length - 1, i = [];
  let s, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", n = P;
  for (let d = 0; d < e; d++) {
    const c = o[d];
    let l, u, p = -1, b = 0;
    for (; b < c.length && (n.lastIndex = b, u = n.exec(c), u !== null); ) b = n.lastIndex, n === P ? u[1] === "!--" ? n = Ut : u[1] !== void 0 ? n = At : u[2] !== void 0 ? (Ft.test(u[2]) && (s = RegExp("</" + u[2], "g")), n = C) : u[3] !== void 0 && (n = C) : n === C ? u[0] === ">" ? (n = s ?? P, p = -1) : u[1] === void 0 ? p = -2 : (p = n.lastIndex - u[2].length, l = u[1], n = u[3] === void 0 ? C : u[3] === '"' ? Pt : Rt) : n === Pt || n === Rt ? n = C : n === Ut || n === At ? n = P : (n = C, s = void 0);
    const w = n === C && o[d + 1].startsWith("/>") ? " " : "";
    a += n === P ? c + he : p >= 0 ? (i.push(l), c.slice(0, p) + Bt + c.slice(p) + x + w) : c + x + (p === -2 ? d : w);
  }
  return [Vt(o, a + (o[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class O {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let a = 0, n = 0;
    const d = t.length - 1, c = this.parts, [l, u] = ue(t, e);
    if (this.el = O.createElement(l, i), S.currentNode = this.el.content, e === 2 || e === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = S.nextNode()) !== null && c.length < d; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(Bt)) {
          const b = u[n++], w = s.getAttribute(p).split(x), $ = /([.?@])?(.*)/.exec(b);
          c.push({ type: 1, index: a, name: $[2], strings: w, ctor: $[1] === "." ? ge : $[1] === "?" ? fe : $[1] === "@" ? be : et }), s.removeAttribute(p);
        } else p.startsWith(x) && (c.push({ type: 6, index: a }), s.removeAttribute(p));
        if (Ft.test(s.tagName)) {
          const p = s.textContent.split(x), b = p.length - 1;
          if (b > 0) {
            s.textContent = B ? B.emptyScript : "";
            for (let w = 0; w < b; w++) s.append(p[w], z()), S.nextNode(), c.push({ type: 2, index: ++a });
            s.append(p[b], z());
          }
        }
      } else if (s.nodeType === 8) if (s.data === Ht) c.push({ type: 2, index: a });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(x, p + 1)) !== -1; ) c.push({ type: 7, index: a }), p += x.length - 1;
      }
      a++;
    }
  }
  static createElement(t, e) {
    const i = q.createElement("template");
    return i.innerHTML = t, i;
  }
}
function A(o, t, e = o, i) {
  if (t === U) return t;
  let s = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const a = N(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== a && (s?._$AO?.(!1), a === void 0 ? s = void 0 : (s = new a(o), s._$AT(o, e, i)), i !== void 0 ? (e._$Co ??= [])[i] = s : e._$Cl = s), s !== void 0 && (t = A(o, s._$AS(o, t.values), s, i)), t;
}
class pe {
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
    const { el: { content: e }, parts: i } = this._$AD, s = (t?.creationScope ?? q).importNode(e, !0);
    S.currentNode = s;
    let a = S.nextNode(), n = 0, d = 0, c = i[0];
    for (; c !== void 0; ) {
      if (n === c.index) {
        let l;
        c.type === 2 ? l = new j(a, a.nextSibling, this, t) : c.type === 1 ? l = new c.ctor(a, c.name, c.strings, this, t) : c.type === 6 && (l = new me(a, this, t)), this._$AV.push(l), c = i[++d];
      }
      n !== c?.index && (a = S.nextNode(), n++);
    }
    return S.currentNode = q, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class j {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, s) {
    this.type = 2, this._$AH = h, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
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
    t = A(this, t, e), N(t) ? t === h || t == null || t === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : t !== this._$AH && t !== U && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : de(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== h && N(this._$AH) ? this._$AA.nextSibling.data = t : this.T(q.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = O.createElement(Vt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const a = new pe(s, this), n = a.u(this.options);
      a.p(e), this.T(n), this._$AH = a;
    }
  }
  _$AC(t) {
    let e = Tt.get(t.strings);
    return e === void 0 && Tt.set(t.strings, e = new O(t)), e;
  }
  k(t) {
    wt(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const a of t) s === e.length ? e.push(i = new j(this.O(z()), this.O(z()), this, this.options)) : i = e[s], i._$AI(a), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = qt(t).nextSibling;
      qt(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class et {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, a) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = h;
  }
  _$AI(t, e = this, i, s) {
    const a = this.strings;
    let n = !1;
    if (a === void 0) t = A(this, t, e, 0), n = !N(t) || t !== this._$AH && t !== U, n && (this._$AH = t);
    else {
      const d = t;
      let c, l;
      for (t = a[0], c = 0; c < a.length - 1; c++) l = A(this, d[i + c], e, c), l === U && (l = this._$AH[c]), n ||= !N(l) || l !== this._$AH[c], l === h ? t = h : t !== h && (t += (l ?? "") + a[c + 1]), this._$AH[c] = l;
    }
    n && !s && this.j(t);
  }
  j(t) {
    t === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class ge extends et {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === h ? void 0 : t;
  }
}
class fe extends et {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== h);
  }
}
class be extends et {
  constructor(t, e, i, s, a) {
    super(t, e, i, s, a), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = A(this, t, e, 0) ?? h) === U) return;
    const i = this._$AH, s = t === h && i !== h || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, a = t !== h && (i === h || s);
    s && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class me {
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
const ve = $t.litHtmlPolyfillSupport;
ve?.(O, j), ($t.litHtmlVersions ??= []).push("3.3.3");
const ye = (o, t, e) => {
  const i = e?.renderBefore ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const a = e?.renderBefore ?? null;
    i._$litPart$ = s = new j(t.insertBefore(z(), a), a, void 0, e ?? {});
  }
  return s._$AI(o), s;
};
const _t = globalThis;
class y extends E {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = ye(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return U;
  }
}
y._$litElement$ = !0, y.finalized = !0, _t.litElementHydrateSupport?.({ LitElement: y });
const $e = _t.litElementPolyfillSupport;
$e?.({ LitElement: y });
(_t.litElementVersions ??= []).push("4.2.2");
class g extends Error {
  constructor(t) {
    super(t), this.code = t;
  }
}
const m = "kaleidescape_companion", we = 15e3, v = ({ entry_id: o, dataset_id: t }) => ({
  entry_id: o,
  dataset_id: t
}), _e = 256 * 1024 * 1024, Lt = 5 * 1024 * 1024, ke = 32 * 1024 * 1024;
function xe() {
  const o = globalThis.crypto;
  if (typeof o?.randomUUID == "function") return o.randomUUID();
  if (typeof o?.getRandomValues != "function")
    throw new g("request_id_unavailable");
  const t = o.getRandomValues(new Uint8Array(16));
  t[6] = t[6] & 15 | 64, t[8] = t[8] & 63 | 128;
  const e = Array.from(
    t,
    (i) => i.toString(16).padStart(2, "0")
  ).join("");
  return `${e.slice(0, 8)}-${e.slice(8, 12)}-${e.slice(12, 16)}-${e.slice(16, 20)}-${e.slice(20)}`;
}
async function st(o, t, e) {
  const i = o.body?.getReader();
  if (!i) throw new g("storage_error");
  const s = [];
  let a = 0;
  try {
    for (; ; ) {
      const { value: n, done: d } = await i.read();
      if (d) break;
      if (a += n.byteLength, a > t) throw new g("export_too_large");
      s.push(new Uint8Array(n));
    }
    return new Blob(s, { type: e });
  } finally {
    await i.cancel().catch(() => {
    }), i.releaseLock();
  }
}
function f(o) {
  return typeof o == "object" && o !== null && "code" in o && typeof o.code == "string" ? o.code : "connection_lost";
}
function _(o) {
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
    database_page_too_large: "The database page is too large. Choose fewer rows per page.",
    library_page_too_large: "This library page is too large. Reduce entries per page and try again.",
    purchase_too_large: "Purchase history exceeds the 8 MiB upload limit.",
    collection_disabled: "Enable Add to Collection and collection sync in Settings first.",
    collection_form: "The server’s collection add form was not recognized. Refresh or sync before starting another add.",
    collection_uncertain: "Check or acknowledge the previous unconfirmed collection add first.",
    collection_limit: "Collection request history reached its storage limit.",
    library_too_large: "A library response exceeded its safety limit. Cached data is retained.",
    library_artwork: "Some artwork could not be cached. Previous artwork is retained when available."
  }[f(o)] ?? "The connection was interrupted. The result could not be confirmed.";
}
async function Ce(o) {
  let t;
  try {
    return await Promise.race([
      o,
      new Promise((e, i) => {
        t = setTimeout(
          () => i(new g("connection_lost")),
          we
        );
      })
    ]);
  } finally {
    clearTimeout(t);
  }
}
class Wt {
  constructor(t) {
    this.transport = t;
  }
  call(t) {
    return Ce(this.transport.callWS(t));
  }
  info() {
    return this.call({ type: `${m}/info` });
  }
  list(t, e = "", i = "", s) {
    return this.call({
      type: `${m}/journal/list`,
      ...v(t),
      query: e,
      limit: 25,
      ...i ? { status: i } : {},
      ...s ? { cursor: s } : {}
    });
  }
  get(t, e) {
    return this.call({
      type: `${m}/journal/get`,
      ...v(t),
      viewing_id: e
    });
  }
  sessions(t, e) {
    return this.call({
      type: `${m}/journal/sessions`,
      ...v(t),
      viewing_id: e
    });
  }
  nowPlaying(t) {
    return this.call({ type: `${m}/now_playing`, ...v(t) });
  }
  libraryInfo(t) {
    return this.call({ type: `${m}/library/info`, ...v(t) });
  }
  libraryList(t, e = {}) {
    return this.call({
      type: `${m}/library/list`,
      ...v(t),
      filters: e
    });
  }
  libraryVersions(t, e, i = 0, s) {
    return this.call({
      type: `${m}/library/versions`,
      ...v(t),
      title_id: e,
      offset: i,
      ...s === void 0 ? {} : { revision: s }
    });
  }
  librarySync(t) {
    return this.call({ type: `${m}/library/sync`, ...v(t) });
  }
  collectionTargets(t, e, i) {
    return this.call({
      type: `${m}/library/collections/targets`,
      ...v(t),
      title_id: e,
      revision: i
    });
  }
  prepareCollectionAdd(t, e, i, s) {
    return this.prepareCommand(t, "library/collections/add", {
      title_id: e,
      collection: i,
      revision: s
    });
  }
  collectionAdd(t) {
    return this.call({ ...t.message });
  }
  collectionCheck(t, e) {
    return this.call({
      type: `${m}/library/collections/check`,
      ...v(t),
      request_id: e
    });
  }
  collectionAcknowledge(t, e) {
    return this.call({
      type: `${m}/library/collections/acknowledge`,
      ...v(t),
      request_id: e,
      confirmation: "ACKNOWLEDGE"
    });
  }
  async purchasePreview(t, e, i) {
    if (e.size > 8 * 1024 * 1024) throw new g("purchase_too_large");
    const s = await this.transport.fetchWithAuth(
      `/api/${m}/${encodeURIComponent(t.entry_id)}/${encodeURIComponent(t.dataset_id)}/library/purchases/preview`,
      {
        method: "POST",
        body: e,
        signal: i,
        redirect: "error",
        headers: { "Content-Type": "application/octet-stream" }
      }
    );
    if (!s.ok) {
      if ([401, 403].includes(s.status))
        throw new g("unauthorized");
      if (s.status === 413) throw new g("purchase_too_large");
      const a = await s.json().catch(() => null);
      throw new g(a?.code ?? "connection_lost");
    }
    return s.json();
  }
  preparePurchaseDates(t, e, i) {
    return this.prepareCommand(t, "library/purchases/apply", {
      revision: e,
      updates: i
    });
  }
  purchaseDates(t) {
    return this.call({ ...t.message });
  }
  async libraryArtwork(t, e, i) {
    if (!/^[a-f0-9]{64}$/.test(e)) throw new g("invalid_request");
    const s = await this.transport.fetchWithAuth(
      `/api/${m}/${encodeURIComponent(t.entry_id)}/${encodeURIComponent(t.dataset_id)}/library/artwork/${e}`,
      {
        signal: i,
        cache: "no-store",
        redirect: "error"
      }
    );
    if (!s.ok)
      throw await s.body?.cancel(), new g(
        [401, 403].includes(s.status) ? "unauthorized" : "not_found"
      );
    const a = s.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (!a || !["image/jpeg", "image/png", "image/webp"].includes(a))
      throw await s.body?.cancel(), new g("invalid_request");
    return st(s, Lt, a);
  }
  settings(t, e, i = {}) {
    return this.call({
      ...i,
      ...v(t),
      type: `${m}/settings/${e}`
    });
  }
  inspect(t, e, i = 0, s, a) {
    return this.call({
      type: `${m}/database/inspect`,
      ...v(t),
      table: e,
      offset: i,
      ...s == null ? {} : { revision: s },
      ...a
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
    if (!s) throw new g("invalid_request");
    if (!e.size || e.size > ke)
      throw new g("import_too_large");
    return this.prepareCommand(t, "database/import", { format: s, revision: i });
  }
  async importFile(t, e, i) {
    const { scope: s, message: a } = t, n = new URLSearchParams({
      format: String(a.format),
      request_id: String(a.request_id),
      revision: String(a.revision)
    }), d = await this.transport.fetchWithAuth(
      `/api/${m}/${encodeURIComponent(s.entry_id)}/${encodeURIComponent(s.dataset_id)}/import?${n}`,
      {
        method: "POST",
        body: e,
        signal: i,
        redirect: "error",
        headers: { "Content-Type": "application/octet-stream" }
      }
    );
    if (!d.ok) {
      const c = {
        401: "unauthorized",
        403: "unauthorized",
        413: "import_too_large",
        404: "not_found"
      };
      if (c[d.status]) throw new g(c[d.status]);
      const l = await d.json().catch(() => null);
      throw new g(l?.code ?? "connection_lost");
    }
    return d.json();
  }
  purge(t) {
    return this.call({ ...t.message });
  }
  async artwork(t, e) {
    if (!/^media_player\.[a-z0-9_]{1,255}$/.test(t))
      throw new g("invalid_request");
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
      throw new g(
        [401, 403].includes(i.status) ? "unauthorized" : "not_ready"
      );
    }
    const s = i.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    return !s || !["image/jpeg", "image/png", "image/webp"].includes(s) ? (await i.body?.cancel(), null) : st(i, Lt, s);
  }
  prepare(t, e, i) {
    return this.prepareCommand(t, `journal/${e}`, i);
  }
  prepareCommand(t, e, i) {
    const s = structuredClone({
      ...i,
      ...v(t),
      type: `${m}/${e}`,
      request_id: xe()
    });
    return { scope: v(t), message: Object.freeze(s) };
  }
  mutate(t) {
    return this.call({ ...t.message });
  }
  async download(t, e, i) {
    const s = `/api/${m}/${encodeURIComponent(t.entry_id)}/${encodeURIComponent(t.dataset_id)}/export?format=${e}`, a = await this.transport.fetchWithAuth(s, {
      signal: i,
      cache: "no-store",
      redirect: "error"
    });
    if (!a.ok) {
      const n = {
        401: "unauthorized",
        403: "unauthorized",
        404: "not_found",
        413: "export_too_large",
        503: "busy"
      };
      throw new g(n[a.status] ?? "storage_error");
    }
    return st(
      a,
      _e,
      e === "json" ? "application/json" : "application/vnd.sqlite3"
    );
  }
}
function Dt(o) {
  const t = new Date(o);
  return new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
}
function L(o) {
  return {
    title: o?.title ?? "",
    started_at: Dt(o?.started_at ?? (/* @__PURE__ */ new Date()).toISOString()),
    ended_at: o?.ended_at ? Dt(o.ended_at) : "",
    duration_seconds: o?.duration_seconds == null ? "" : (o.duration_seconds / 60).toFixed(2),
    watched_seconds: ((o?.watched_seconds ?? 0) / 60).toFixed(2),
    status: o?.status ?? "partial",
    notes: o?.notes ?? "",
    source_id: o?.source_id ?? "",
    player_id: o?.player_id ?? "",
    raw_content_id: o?.raw_content_id ?? ""
  };
}
function Jt(o, t) {
  const e = {};
  for (const [i, s] of Object.entries(o))
    t && s === t[i] || (i === "started_at" || i === "ended_at" ? e[i] = s ? new Date(s).toISOString() : null : i === "duration_seconds" || i === "watched_seconds" ? e[i] = s === "" ? null : Number(s) * 60 : ["source_id", "player_id", "raw_content_id"].includes(i) ? e[i] = s === "" ? null : s : e[i] = s);
  return e;
}
function Kt(o, t) {
  function e(i, s, a = "text", n = !1, d) {
    return r`<label
      >${s}<input
        id=${i === "title" ? "title" : i}
        name=${i}
        type=${a}
        .value=${o[i]}
        ?required=${n}
        maxlength=${d ?? h}
        min=${a === "number" ? "0" : h}
        max=${a === "number" ? String(1e9 / 60) : h}
        step=${a === "datetime-local" ? "1" : a === "number" ? "0.01" : h}
        @input=${(c) => t(i, c)}
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
          .value=${o.status}
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
          .value=${o.notes}
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
const k = Z`
  :host {
    display: block;
    min-height: 0;
    color: var(--primary-text-color, #20302c);
    background: var(--primary-background-color, #f5f7f6);
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    --accent: var(--primary-color, #256b59);
    --line: var(--divider-color, #dbe3df);
    --surface: var(--card-background-color, #fff);
    --muted: var(--secondary-text-color, #52645d);
  }
  :host(kaleidescape-panel),
  :host(kaleidescape-reader) {
    min-height: 100dvh;
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
  .view-switch {
    display: flex;
    gap: 0;
  }
  .view-switch button[aria-pressed="true"] {
    color: var(--accent);
    border-color: var(--accent);
  }
  .page-size {
    width: 130px;
  }
  .cover-size {
    width: 150px;
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
  .cover-tile span {
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
  .purchase-preview {
    max-height: 50vh;
    overflow: auto;
    margin-block: 16px;
  }
  .purchase-preview section {
    padding: 12px;
    border-bottom: 1px solid var(--line);
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
`, Se = [
  "now-playing",
  "library",
  "journal",
  "database",
  "settings"
];
function Gt(o, t, e) {
  const i = (a) => Se.includes(a) && (t || a === "journal" || a === "library") && (a !== "library" || e), s = new URL(location.href).searchParams.get("companion_page");
  return i(s) ? s : i(o) ? o : "journal";
}
function D(o) {
  const t = new URL(location.href);
  t.searchParams.set("companion_page", o), history.replaceState(history.state, "", t);
}
function R(o) {
  const t = o.currentTarget;
  if (o.target !== t) return;
  const e = t.getBoundingClientRect();
  o.clientX >= e.left && o.clientX <= e.right && o.clientY >= e.top && o.clientY <= e.bottom || t.dispatchEvent(new Event("cancel", { cancelable: !0 })) && t.close();
}
class zt {
  constructor() {
    this.active = 0, this.waiting = [];
  }
  acquire(t) {
    return new Promise((e, i) => {
      const s = () => {
        this.waiting = this.waiting.filter((n) => n !== a), i(new DOMException("Aborted", "AbortError"));
      }, a = () => {
        t.removeEventListener("abort", s), this.active++;
        let n = !1;
        e(() => {
          n || (n = !0, this.active--, this.waiting.shift()?.());
        });
      };
      if (t.aborted) return s();
      this.active < 3 ? a() : (this.waiting.push(a), t.addEventListener("abort", s, { once: !0 }));
    });
  }
}
const H = class H extends y {
  constructor() {
    super(...arguments), this.title = "", this.visible = !1, this.generation = 0, this.visibility = () => {
      document.hidden ? this.clear() : this.load();
    };
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.observer = new IntersectionObserver((t) => {
      this.visible = t.some((e) => e.isIntersecting), this.visible ? this.load() : this.clear();
    }), this.observer.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.observer?.disconnect(), this.clear();
  }
  updated(t) {
    ["client", "scope", "artworkKey", "queue"].some((e) => t.has(e)) && (this.clear(), this.load());
  }
  clear() {
    this.generation++, this.controller?.abort(), this.controller = void 0, this.url && (URL.revokeObjectURL(this.url), this.url = void 0, this.requestUpdate());
  }
  async load() {
    if (!this.visible || document.hidden || !this.isConnected || this.controller || this.url || !this.client || !this.scope?.library_enabled || !this.artworkKey || !this.queue)
      return;
    const t = this.generation, e = this.controller = new AbortController();
    let i, s;
    try {
      if (i = await this.queue.acquire(e.signal), e.signal.aborted) return;
      s = setTimeout(() => e.abort(), 5e3);
      const a = await this.client.libraryArtwork(
        this.scope,
        this.artworkKey,
        e.signal
      );
      if (t !== this.generation || e.signal.aborted || !this.isConnected || document.hidden)
        return;
      this.url = URL.createObjectURL(a), this.requestUpdate();
    } catch (a) {
      t === this.generation && f(a) === "unauthorized" && this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      );
    } finally {
      clearTimeout(s), i?.(), t === this.generation && (this.controller = void 0);
    }
  }
  render() {
    return this.url ? r`<img
          src=${this.url}
          alt=${`Cover for ${this.title}`}
          @error=${this.clear}
        />` : r`<span>No cached artwork</span>`;
  }
};
H.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  queue: { attribute: !1 },
  artworkKey: { attribute: !1 },
  title: { type: String }
}, H.styles = Z`
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
let lt = H;
customElements.get("kaleidescape-library-cover") || customElements.define("kaleidescape-library-cover", lt);
const F = class F extends y {
  constructor() {
    super(...arguments), this.generation = 0, this.selected = /* @__PURE__ */ new Map(), this.busy = !1, this.error = "", this.notice = "";
  }
  willUpdate(t) {
    (t.has("client") || t.has("scope")) && this.clear();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear();
  }
  clear() {
    this.generation++, this.controller?.abort(), this.controller = void 0, this.preview = this.pending = void 0, this.selected.clear(), this.busy = !1, this.error = this.notice = "", this.renderRoot.querySelector("dialog")?.close();
  }
  confirmNavigation() {
    return !this.busy && (!this.pending || window.confirm(
      "Discard this unconfirmed purchase-date retry? Inspect saved dates before making another correction."
    ));
  }
  close(t) {
    if (t?.preventDefault(), this.pending) return;
    this.generation++, this.busy = !1, this.controller?.abort(), this.preview = void 0, this.selected.clear();
    const e = this.renderRoot.querySelector('input[type="file"]');
    e && (e.value = ""), this.renderRoot.querySelector("dialog")?.close(), this.requestUpdate();
  }
  fail(t) {
    this.error = _(t), f(t) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
  }
  async open() {
    this.error = this.notice = "", this.requestUpdate(), await this.updateComplete, this.renderRoot.querySelector("dialog")?.showModal();
  }
  async upload(t) {
    const e = t.target, i = e.files?.[0];
    if (e.value = "", !i || !this.client || !this.scope || this.busy || this.pending)
      return;
    const s = ++this.generation;
    this.busy = !0, this.preview = void 0, this.selected.clear(), this.error = "", this.controller = new AbortController();
    const a = setTimeout(() => this.controller?.abort(), 35e3);
    this.requestUpdate();
    try {
      const n = await this.client.purchasePreview(
        this.scope,
        i,
        this.controller.signal
      );
      s === this.generation && (this.preview = n);
    } catch (n) {
      s === this.generation && this.fail(n);
    } finally {
      clearTimeout(a), s === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async save() {
    if (!this.client || !this.scope || !this.preview || this.busy) return;
    if (!this.pending)
      try {
        this.pending = this.client.preparePurchaseDates(
          this.scope,
          this.preview.revision,
          [...this.selected].map(([e, i]) => ({
            title_id: e,
            purchased_on: i
          }))
        );
      } catch (e) {
        this.fail(e), this.requestUpdate();
        return;
      }
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      const e = await this.client.purchaseDates(this.pending);
      if (t !== this.generation) return;
      this.pending = void 0, this.busy = !1, this.notice = `Updated purchase dates for ${e.updated_count} versions.`, this.close(), this.dispatchEvent(
        new CustomEvent("purchase-dates-changed", {
          bubbles: !0,
          composed: !0
        })
      );
    } catch (e) {
      if (t !== this.generation) return;
      [
        "conflict",
        "invalid_request",
        "not_found",
        "library_disabled",
        "backup_in_progress",
        "busy",
        "library_storage_limit"
      ].includes(f(e)) && (this.pending = void 0), this.fail(e);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  render() {
    if (!this.scope?.permissions.edit) return h;
    const t = this.busy || !!this.pending;
    return r`<button @click=${this.open}>Import purchase dates</button>
      ${this.notice ? r`<p role="status">${this.notice}</p>` : h}
      <dialog
        class="database-dialog library-dialog"
        @click=${R}
        @cancel=${this.close}
        aria-labelledby="purchase-title"
      >
        <div class="card-head">
          <h2 id="purchase-title">Import purchase dates</h2>
          <button ?disabled=${!!this.pending} @click=${this.close}>
            Close
          </button>
        </div>
        <p>
          Select a saved Kaleidescape purchase-history HTML file (UTF-8, up to 8
          MiB). No page scripts or links are used. Rentals, pending invoices,
          and cancelled rows are skipped; repeated purchases use the earliest
          date.
        </p>
        <p>
          Exact title names suggest matches, not proof of edition identity.
          Review each version and date before applying. First-detected dates and
          viewing history are preserved.
        </p>
        <label
          >Purchase history HTML<input
            type="file"
            accept=".html,.htm,text/html"
            ?disabled=${t}
            @change=${this.upload}
        /></label>
        ${this.busy ? r`<p role="status">Working…</p>` : h}
        ${this.error ? r`<p role="alert" class="error">${this.error}</p>` : h}
        ${this.pending ? r`<p class="warning">
                  The result is unconfirmed. Retry the same correction to
                  confirm it.
                </p>
                <button
                  ?disabled=${this.busy}
                  @click=${() => {
      window.confirm(
        "Discard the retry? Inspect saved dates before making another correction."
      ) && (this.pending = void 0, this.close());
    }}
                >
                  Discard retry
                </button>` : h}
        ${this.preview ? r`<p>
                  ${this.preview.rows.length} purchase names ·
                  ${this.preview.rows.filter((e) => !e.versions.length).length}
                  unmatched ·
                  ${this.preview.rows.filter((e) => e.ambiguous).length}
                  ambiguous · ${this.selected.size} versions selected (maximum
                  1000)
                </p>
                <button
                  ?disabled=${t}
                  @click=${() => {
      this.selected.clear();
      for (const e of this.preview.rows)
        if (!e.ambiguous)
          for (const i of e.versions)
            this.selected.size < 1e3 && this.selected.set(i.id, e.purchased_on);
      this.requestUpdate();
    }}
                >
                  Select unambiguous matches
                </button>
                <div class="purchase-preview">
                  ${this.preview.rows.map(
      (e) => r`<section>
                        <strong>${e.title}</strong> ·
                        ${e.purchased_on}${e.ambiguous ? r`<span class="warning"> · Ambiguous: choose exact versions</span>` : h}
                        ${e.versions.length ? h : r`<p class="muted">No exact cached title match; skipped.</p>`}
                        ${e.versions.map(
        (i) => r`<label class="check"
                              ><input
                                type="checkbox"
                                .checked=${this.selected.has(i.id)}
                                ?disabled=${t || this.selected.size >= 1e3 && !this.selected.has(i.id)}
                                @change=${(s) => {
          s.target.checked ? this.selected.set(
            i.id,
            e.purchased_on
          ) : this.selected.delete(i.id), this.requestUpdate();
        }}
                              />${i.year ?? "Year unknown"} ·
                              ${i.edition || "Format unknown"} · currently
                              ${i.purchased_on ?? "unknown"} ·
                              ${i.id.slice(0, 8)}</label
                            >`
      )}
                        ${e.versions_truncated ? r`<p class="warning">Only the first 50 matching versions are shown.</p>` : h}
                      </section>`
    )}
                </div>
                <div class="actions dialog-footer">
                  <button
                    class="primary"
                    ?disabled=${this.busy || !this.pending && !this.selected.size}
                    @click=${this.save}
                  >
                    ${this.pending ? "Retry same correction" : `Apply ${this.selected.size} purchase dates`}
                  </button>
                </div>` : h}
      </dialog>`;
  }
};
F.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, F.styles = k;
let ht = F;
customElements.get("kaleidescape-library-purchases") || customElements.define("kaleidescape-library-purchases", ht);
const V = class V extends y {
  constructor() {
    super(...arguments), this.revision = 0, this.enabled = !1, this.blocked = !1, this.generation = 0, this.choices = [], this.selected = "", this.loading = !1, this.busy = !1, this.error = "", this.notice = "";
  }
  willUpdate(t) {
    (t.has("client") || t.has("scope") || t.has("version") || t.has("enabled") && !this.enabled) && this.clear();
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
  close(t) {
    t?.preventDefault(), this.confirmNavigation() && (this.generation++, this.loading = !1, this.renderRoot.querySelector("dialog")?.close(), this.requestUpdate());
  }
  fail(t) {
    this.error = _(t), ["unauthorized", "library_disabled"].includes(f(t)) && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        f(t) === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    ));
  }
  async open() {
    if (!this.client || !this.scope || !this.version || !this.enabled || this.blocked)
      return;
    const t = ++this.generation;
    if (this.loading = !0, this.error = this.notice = this.selected = "", this.choices = [], this.requestUpdate(), await this.updateComplete, !(t !== this.generation || !this.isConnected)) {
      this.renderRoot.querySelector("dialog")?.showModal();
      try {
        const e = await this.client.collectionTargets(
          this.scope,
          this.version.id,
          this.revision
        );
        t === this.generation && (this.choices = e.collections);
      } catch (e) {
        t === this.generation && this.fail(e);
      } finally {
        t === this.generation && (this.loading = !1, this.requestUpdate());
      }
    }
  }
  changed(t) {
    this.dispatchEvent(
      new CustomEvent("collection-changed", {
        detail: t,
        bubbles: !0,
        composed: !0
      })
    );
  }
  complete(t) {
    this.pending = void 0, this.busy = !1, this.notice = t.status === "confirmed" ? "Collection membership confirmed on the device." : t.status === "abandoned" ? "The request was acknowledged without sending another add." : "The add is not confirmed. Close this window and check the pending request on the Library page.", this.close(), this.changed(t);
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
    } catch (e) {
      this.fail(e), this.requestUpdate();
      return;
    }
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      const e = await this.client.collectionAdd(this.pending);
      t === this.generation && this.complete(e);
    } catch (e) {
      t === this.generation && this.fail(e);
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async check() {
    if (!this.client || !this.scope || !this.pending || this.busy) return;
    const t = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      const e = await this.client.collectionCheck(
        this.scope,
        String(this.pending.message.request_id)
      );
      t === this.generation && this.complete(e);
    } catch (e) {
      t === this.generation && (f(e) === "not_found" ? (this.pending = void 0, this.error = "No accepted add request was found. Refresh title details before starting another add.") : this.fail(e));
    } finally {
      t === this.generation && (this.busy = !1, this.requestUpdate());
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
        @click=${R}
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
                    @change=${(t) => {
      this.selected = t.target.value, this.requestUpdate();
    }}
                  >
                    <option value="">Choose a collection</option>
                    ${this.choices.map((t) => r`<option value=${t}>${t}</option>`)}
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
V.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  version: { attribute: !1 },
  revision: { type: Number },
  enabled: { type: Boolean },
  blocked: { type: Boolean }
}, V.styles = k;
let dt = V;
customElements.get("kaleidescape-library-collection-add") || customElements.define(
  "kaleidescape-library-collection-add",
  dt
);
const at = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["rating", "Rating", "rating"]
], Nt = [
  ["name", "Title"],
  ["year", "Year"],
  ["collection", "Collection"],
  ["length", "Length"],
  ["watched", "Status"],
  ["added", "Added on"]
], M = {
  watched: "Watched",
  unwatched: "Unwatched",
  in_progress: "In progress",
  unknown: "Unknown"
}, W = class W extends y {
  constructor() {
    super(...arguments), this.bound = "", this.generation = 0, this.listRequest = 0, this.statusRequest = 0, this.versionRequest = 0, this.versionsLoading = !1, this.versionsError = "", this.widths = [360, 90, 260, 150, 140, 210], this.collectionLocked = !1, this.checkingCollection = !1, this.filters = {
      query: "",
      sort: "name",
      descending: !1
    }, this.applied = { ...this.filters }, this.loading = !1, this.requesting = !1, this.error = "", this.notice = "", this.covers = new zt(), this.mode = "list", this.coverSize = 150, this.entriesPerPage = 50, this.coverColumns = 1, this.gridWidth = 0, this.requestLimit = 50, this.requestedOffset = 0, this.draft = {}, this.facetSearch = "", this.visibility = () => {
      clearTimeout(this.timer), document.hidden ? (clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0) : (this.refreshStatus(), this.scheduleLayoutPage());
    };
  }
  confirmNavigation() {
    return this.collectionLocked || this.checkingCollection ? !1 : this.renderRoot.querySelector("kaleidescape-library-purchases")?.confirmNavigation() ?? !0;
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if (!(this.boundClient === this.client && this.bound === e) && (this.clear(), this.boundClient = this.client, this.bound = e, this.client && this.scope?.library_enabled)) {
      this.mode = this.scope.ui_defaults?.library_default_view === "covers" ? "covers" : "list";
      const i = this.scope.ui_defaults?.library_default_count ?? 50;
      this.entriesPerPage = Number.isInteger(i) && i >= 1 && i <= 1e3 ? i : 50, this.load(), this.refreshStatus();
    }
  }
  clear() {
    this.generation++, this.listRequest++, clearTimeout(this.timer), clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0, this.gridObserver?.disconnect(), this.gridObserver = void 0, this.grid = void 0, this.gridWidth = 0, this.coverColumns = 1, this.entriesPerPage = this.requestLimit = 50, this.requestedOffset = 0;
    for (const t of this.renderRoot.querySelectorAll("dialog"))
      t.close();
    this.covers = new zt(), this.draft = {}, this.facetSearch = "", this.page = this.info = this.selected = void 0, this.collectionLocked = this.checkingCollection = !1, this.clearVersions(), this.widths = [360, 90, 260, 150, 140, 210], this.resize = void 0, this.filters = { query: "", sort: "name", descending: !1 }, this.applied = { ...this.filters }, this.loading = this.requesting = !1, this.error = this.notice = "", this.requestUpdate();
  }
  updated() {
    const t = this.isConnected && this.mode === "covers" && this.scope?.library_enabled && this.client ? this.renderRoot.querySelector(".cover-grid") ?? void 0 : void 0;
    t !== this.grid && (this.gridObserver?.disconnect(), this.grid = t, t && (this.gridObserver = new ResizeObserver((e) => {
      const i = e.find((s) => s.target === this.grid);
      i && this.isConnected && this.fitGrid(i.contentRect.width);
    }), this.gridObserver.observe(t))), t && this.fitGrid(t.getBoundingClientRect().width || this.gridWidth);
  }
  get pageSize() {
    return this.mode === "list" ? this.entriesPerPage : Math.max(
      this.coverColumns,
      Math.floor(this.entriesPerPage / this.coverColumns) * this.coverColumns
    );
  }
  fitGrid(t) {
    if (!this.isConnected || !Number.isFinite(t) || t <= 0 || this.mode !== "covers")
      return;
    this.gridWidth = t;
    const e = Math.max(
      1,
      Math.min(1e3, Math.floor((t + 2) / (this.coverSize + 2)))
    );
    e !== this.coverColumns && (this.coverColumns = e, this.requestUpdate()), this.scheduleLayoutPage();
  }
  scheduleLayoutPage() {
    if (!(!this.client || !this.scope?.library_enabled || !this.isConnected || document.hidden)) {
      if (this.pageSize === this.requestLimit) {
        clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0;
        return;
      }
      this.layoutTimer && this.pendingLimit === this.pageSize || (clearTimeout(this.layoutTimer), this.pendingLimit = this.pageSize, this.layoutTimer = setTimeout(() => {
        this.layoutTimer = void 0, this.pendingLimit = void 0;
        const t = this.loading ? this.requestedOffset : this.page?.offset ?? 0;
        this.load(Math.floor(t / this.pageSize) * this.pageSize, !0);
      }, 100), this.requestUpdate());
    }
  }
  async setMode(t) {
    this.mode !== t && (this.mode = t, this.requestUpdate(), await this.updateComplete, this.scheduleLayoutPage());
  }
  changePageSize(t) {
    const e = t.target, i = Number(e.value);
    if (!Number.isInteger(i) || i < 1 || i > 1e3) {
      e.reportValidity();
      return;
    }
    this.entriesPerPage = i, this.requestUpdate(), this.scheduleLayoutPage();
  }
  fail(t) {
    const e = f(t);
    (e === "unauthorized" || e === "library_disabled") && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        e === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    )), this.error = _(t), this.requestUpdate();
  }
  async load(t = 0, e = !1) {
    if (this.collectionLocked || !this.client || !this.scope?.library_enabled) return;
    clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0;
    const i = this.generation, s = ++this.listRequest, a = this.pageSize;
    this.requestLimit = a, this.requestedOffset = t, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const n = await this.client.libraryList(this.scope, {
        ...this.applied,
        grouped: !0,
        limit: a,
        offset: t,
        ...t && this.page ? {
          revision: this.page.revision,
          ...this.page.preferences_key ? { preferences_key: this.page.preferences_key } : {}
        } : {}
      });
      if (i !== this.generation || s !== this.listRequest || a !== this.pageSize)
        return;
      this.page = n, this.selected && (this.selected = n.items.find((d) => d.id === this.selected?.id) ?? (e ? this.selected : void 0), this.selected ? this.versions && (this.versions.revision !== n.revision || this.versions.preferences_key !== n.preferences_key) && this.loadVersions() : this.closeDialog("title-dialog"));
    } catch (n) {
      i === this.generation && s === this.listRequest && this.fail(n);
    } finally {
      i === this.generation && s === this.listRequest && (this.loading = !1, this.requestUpdate());
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
      this.info = s, this.page && (this.page.revision !== s.revision || this.page.preferences_key !== s.preferences_key) && !this.loading && this.load();
    } catch (s) {
      i = f(s) === "unauthorized", t === this.generation && e === this.statusRequest && this.fail(s);
    } finally {
      t === this.generation && e === this.statusRequest && this.isConnected && !i && !document.hidden && (this.timer = setTimeout(
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
  async openDialog(t) {
    this.requestUpdate(), await this.updateComplete, this.isConnected && this.renderRoot.querySelector(`#${t}`)?.showModal();
  }
  closeDialog(t) {
    t === "title-dialog" && this.collectionLocked || (this.renderRoot.querySelector(`#${t}`)?.close(), t === "title-dialog" && (this.selected = void 0, this.clearVersions()), this.requestUpdate());
  }
  select(t) {
    this.clearVersions(), this.selected = t, this.openDialog("title-dialog"), this.loadVersions();
  }
  clearVersions() {
    this.collectionLocked = !1, this.versionRequest++, this.versions = void 0, this.activeVersion = void 0, this.versionsError = "", this.versionsLoading = !1;
  }
  async loadVersions(t = 0) {
    if (this.collectionLocked || !this.client || !this.scope || !this.selected) return;
    const e = this.generation, i = ++this.versionRequest, s = this.selected.id;
    this.versionsLoading = !0, this.versionsError = "", this.activeVersion = void 0, this.requestUpdate();
    try {
      const a = await this.client.libraryVersions(
        this.scope,
        s,
        t,
        this.page?.revision
      );
      if (e !== this.generation || i !== this.versionRequest || this.selected?.id !== s)
        return;
      this.versions = a, this.activeVersion = a.items.find((n) => n.id === s) ?? a.items[0];
    } catch (a) {
      e === this.generation && i === this.versionRequest && (["unauthorized", "library_disabled"].includes(f(a)) ? this.fail(a) : this.versionsError = _(a));
    } finally {
      e === this.generation && i === this.versionRequest && (this.versionsLoading = !1, this.requestUpdate());
    }
  }
  format(t) {
    const e = t.formats ?? (t.edition && t.edition.toLowerCase() !== "multiple" ? [t.edition] : []);
    return e.length ? e.join(", ") + (t.formats_truncated ? "…" : "") : "Formats unavailable · sync library to refresh";
  }
  years(t) {
    return t.years?.join(", ") || String(t.year ?? "—");
  }
  runtime(t) {
    if (t.duration_seconds === null) return "Unknown";
    const e = (t.duration_seconds / 60).toFixed(2), i = t.maximum_duration_seconds;
    return `${e}${i != null && i !== t.duration_seconds ? `–${(i / 60).toFixed(2)}` : ""} min`;
  }
  resizeColumn(t, e) {
    ["ArrowLeft", "ArrowRight", "Home"].includes(t.key) && (t.preventDefault(), this.widths[e] = t.key === "Home" ? [360, 90, 260, 150, 140, 210][e] : Math.max(
      80,
      Math.min(
        800,
        this.widths[e] + (t.key === "ArrowLeft" ? -20 : 20)
      )
    ), this.requestUpdate());
  }
  versionKey(t) {
    if (this.collectionLocked || !this.versions?.items.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(t.key))
      return;
    t.preventDefault();
    const e = this.versions.items, i = e.findIndex(
      (a) => a.id === this.activeVersion?.id
    ), s = t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : (i + (t.key === "ArrowLeft" ? -1 : 1) + e.length) % e.length;
    this.activeVersion = e[s], this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#version-${s}`)?.focus()
    );
  }
  sort(t) {
    this.applied = {
      ...this.applied,
      sort: t,
      descending: this.applied.sort === t ? !this.applied.descending : !1
    }, this.load();
  }
  openFilters() {
    this.draft = structuredClone(this.applied), this.facetSearch = "", this.openDialog("filter-dialog");
  }
  choices(t, e) {
    const i = t === "status" ? Object.keys(M) : this.page?.facets[e] ?? [];
    return [
      .../* @__PURE__ */ new Set([...i, ...this.draft[t] ?? []])
    ].filter(
      (s) => s.toLocaleLowerCase().includes(this.facetSearch.toLocaleLowerCase())
    );
  }
  cover(t) {
    return r`<kaleidescape-library-cover
      .client=${this.client}
      .scope=${this.scope}
      .queue=${this.covers}
      .artworkKey=${t.artwork_key}
      .title=${t.title}
    ></kaleidescape-library-cover>`;
  }
  date(t) {
    return t ? new Date(
      t.length === 10 ? `${t}T00:00:00` : t
    ).toLocaleString(void 0, {
      dateStyle: "medium",
      ...t.length === 10 ? {} : { timeStyle: "short" }
    }) : "Not yet synced";
  }
  async checkCollection(t, e = !1) {
    if (!this.client || !this.scope || this.checkingCollection || e && !window.confirm(
      "Inspect the collection on the device first. Acknowledging does not undo an add or send another one; it allows a new request even if this add already applied. Continue?"
    ))
      return;
    const i = this.generation;
    this.checkingCollection = !0, this.error = "", this.requestUpdate();
    try {
      const s = await (e ? this.client.collectionAcknowledge(this.scope, t) : this.client.collectionCheck(this.scope, t));
      if (i !== this.generation) return;
      this.notice = s.status === "confirmed" ? "Collection membership confirmed on the device." : s.status === "abandoned" ? "Request acknowledged. No device edit was sent." : "The requested membership is not confirmed. Inspect the device before acknowledging this request.", this.load(), this.refreshStatus();
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.checkingCollection = !1, this.requestUpdate());
    }
  }
  render() {
    const t = this.page?.limit ?? this.requestLimit, e = this.loading || !!this.layoutTimer, i = this.page?.items ?? [], s = this.mode === "covers" && this.page?.has_more && i.length >= this.coverColumns ? i.slice(
      0,
      i.length - i.length % this.coverColumns
    ) : i, a = this.selected, n = this.activeVersion, d = this.scope?.permissions.edit, c = [...at.map(([l]) => l), "status"].reduce(
      (l, u) => l + (this.applied[u]?.length ?? 0),
      0
    );
    return r`<section
      class="library-page"
      @access-denied=${(l) => {
      l.stopPropagation(), this.fail(new g("unauthorized"));
    }}
    >
      <div class="section-head">
        <h2>Library</h2>
        <div class="actions">
          ${d ? r`<kaleidescape-library-purchases
                  .client=${this.client}
                  .scope=${this.scope}
                  @purchase-dates-changed=${() => {
      this.load(), this.refreshStatus();
    }}
                ></kaleidescape-library-purchases>` : h}
          <button
            ?disabled=${this.loading}
            @click=${() => {
      this.load(), this.refreshStatus();
    }}
          >
            Refresh cached data
          </button>
          ${d ? r`<button class="primary" ?disabled=${this.requesting || !!this.info?.phase && this.info.phase !== "idle"} @click=${this.sync}>Sync now</button>` : h}
        </div>
      </div>
      ${this.info ? r`<p class="muted">
                ${this.info.group_count} titles · ${this.info.title_count}
                versions · ${this.info.collection_count} collections · Last
                catalog sync: ${this.date(this.info.last_synced_at)}
                ${d && this.info.phase && this.info.phase !== "idle" ? r`<br />${{ catalog: "Reading titles", collections: "Reading collections", details: "Fetching title data" }[this.info.phase] ?? "Syncing"}… ${this.info.total ? `${this.info.processed}/${this.info.total}` : ""}` : h}
              </p>
              <p class="muted">
                Played means watched; Paused takes priority. Collections last
                synced: ${this.date(this.info.collections_synced_at)}.
                ${d && this.info.collections_enabled === !1 ? "Collection sync is disabled; retained statuses may be stale." : ""}
              </p>
              ${d && this.info.artwork_enabled ? r`<p class="muted">Artwork cache: ${((this.info.artwork_bytes ?? 0) / 1048576).toFixed(1)} / ${((this.info.artwork_limit_bytes ?? 0) / 1048576).toFixed(0)} MiB</p>` : h}
              ${d && this.info.error ? r`<p class="warning" role="status">${_(new g(this.info.error))}</p>` : h}` : h}
      ${this.error ? r`<p class="error" role="alert">${this.error}<button @click=${() => this.load()}>Refresh results</button></p>` : h}
      ${this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : h}
      ${d ? (this.info?.pending_adds ?? []).map(
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
      <section class="card">
        <div class="library-toolbar">
          <form
            @submit=${(l) => {
      l.preventDefault(), this.applied = { ...this.applied, query: this.filters.query }, this.load();
    }}
          >
            <label
              >Search titles<input
                name="library_query"
                type="search"
                maxlength="500"
                .value=${String(this.filters.query ?? "")}
                @input=${(l) => {
      this.filters.query = l.target.value;
    }}
            /></label>
            <button type="submit" ?disabled=${this.loading}>Search</button>
          </form>
          <button @click=${this.openFilters}>
            Filters${c ? ` (${c})` : ""}
          </button>
          <div class="view-switch" role="group" aria-label="Library view">
            ${["list", "covers"].map(
      (l) => r`<button
                  aria-pressed=${this.mode === l}
                  @click=${() => this.setMode(l)}
                >
                  ${l === "list" ? "List" : "Covers"}
                </button>`
    )}
          </div>
          <label class="page-size"
            >Entries per page<input
              name="library_page_size"
              type="number"
              min="1"
              max="1000"
              step="1"
              .value=${String(this.entriesPerPage)}
              @change=${this.changePageSize}
          /></label>
          ${this.mode === "covers" ? r`<label class="cover-size"
                    >Cover size<input
                      type="range"
                      name="cover_size"
                      min="90"
                      max="300"
                      step="10"
                      .value=${String(this.coverSize)}
                      @input=${(l) => {
      this.coverSize = Number(
        l.target.value
      ), this.fitGrid(this.gridWidth), this.requestUpdate();
    }}
                  /></label>
                  <label
                    >Sort by<select
                      name="library_sort"
                      .value=${String(this.applied.sort)}
                      @change=${(l) => this.sort(l.target.value)}
                    >
                      ${Nt.map(([l, u]) => r`<option value=${l}>${u}</option>`)}
                    </select></label
                  >
                  <button @click=${() => this.sort(String(this.applied.sort))}>
                    ${this.applied.descending ? "Descending ↓" : "Ascending ↑"}
                  </button>` : h}
        </div>
        ${this.mode === "covers" ? r`<div
                class="cover-grid"
                style=${`--cover-size: ${this.coverSize}px; --cover-columns: ${this.coverColumns}`}
              >
                ${s.map(
      (l) => r`<button
                      class="cover-tile"
                      title=${`${l.title}${l.year ? ` (${l.year})` : ""}`}
                      aria-label=${`Details for ${l.title}${l.year ? ` (${l.year})` : ""}`}
                      @click=${() => this.select(l)}
                    >
                      <div class="cover-image">${this.cover(l)}</div>
                      <span
                        >${l.title}${l.year ? ` (${l.year})` : ""}</span
                      >
                    </button>`
    )}
              </div>` : r`<div class="table-wrap">
                <table
                  class="library-table"
                  style=${`--library-width: ${this.widths.reduce((l, u) => l + u, 0)}px`}
                >
                  <colgroup>
                    ${this.widths.map((l) => r`<col style=${`width: ${l}px`} />`)}
                  </colgroup>
                  <thead>
                    <tr>
                      ${Nt.map(
      ([l, u], p) => r`<th
                            aria-sort=${this.applied.sort === l ? this.applied.descending ? "descending" : "ascending" : "none"}
                          >
                            <button
                              class="sort-heading"
                              @click=${() => this.sort(l)}
                            >
                              <span>${u}</span
                              ><span class="sort-icon" aria-hidden="true"
                                >${this.applied.sort === l ? this.applied.descending ? "↓" : "↑" : "↕"}</span
                              >
                            </button>
                            <span
                              class="column-resize"
                              role="separator"
                              aria-label=${`Resize ${u} column`}
                              aria-orientation="vertical"
                              aria-valuemin="80"
                              aria-valuemax="800"
                              aria-valuenow=${this.widths[p]}
                              tabindex="0"
                              title="Drag or use Left/Right to resize; Home resets"
                              @keydown=${(b) => this.resizeColumn(b, p)}
                              @pointerdown=${(b) => {
        b.preventDefault(), this.resize = {
          index: p,
          start: b.clientX,
          width: this.widths[p]
        }, b.currentTarget.setPointerCapture(b.pointerId);
      }}
                              @pointermove=${(b) => {
        this.resize?.index === p && (this.widths[p] = Math.max(
          80,
          Math.min(
            800,
            this.resize.width + b.clientX - this.resize.start
          )
        ), this.requestUpdate());
      }}
                              @pointerup=${() => {
        this.resize = void 0;
      }}
                              @pointercancel=${() => {
        this.resize = void 0;
      }}
                              @lostpointercapture=${() => {
        this.resize = void 0;
      }}
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
                              ${l.title}</button
                            ><small title=${this.format(l)}
                              >${this.format(l)}${(l.version_count ?? 1) > 1 ? ` · ${l.version_count} versions` : ""}</small
                            >
                          </td>
                          <td title=${this.years(l)}>${this.years(l)}</td>
                          <td>
                            <span
                              class="collection-cell"
                              title=${l.collections.join(", ")}
                              >${l.collections.join(", ") || "—"}</span
                            >
                          </td>
                          <td>${this.runtime(l)}</td>
                          <td>${M[l.watched_status]}</td>
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
            >${this.page?.total ?? 0} matching titles · ${this.pageSize} per
            page${this.mode === "covers" ? ` · ${this.coverColumns} covers per row` : ""}</small
          >
          <div class="actions">
            <button
              ?disabled=${e || !this.page?.offset}
              @click=${() => this.load()}
            >
              First
            </button>
            <button
              ?disabled=${e || !this.page?.offset}
              @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - t))}
            >
              Previous
            </button>
            <button
              ?disabled=${e || !this.page?.has_more}
              @click=${() => this.load((this.page?.offset ?? 0) + t)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <dialog
        id="filter-dialog"
        @click=${R}
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
          >Find filter options<input
            name="facet_search"
            type="search"
            .value=${this.facetSearch}
            @input=${(l) => {
      this.facetSearch = l.target.value, this.requestUpdate();
    }}
        /></label>
        ${this.page?.truncated_facets.length ? r`<p class="muted">Each category shows up to 500 known names.</p>` : h}
        <div class="facet-groups">
          ${[...at, ["status", "Watched status", "status"]].map(
      ([l, u, p]) => {
        const b = this.draft[l] ?? [], w = this.choices(l, p);
        return r`<fieldset>
                <legend>${u}</legend>
                <div class="facet-options">
                  ${w.length ? w.map(
          ($) => r`<label class="check"
                              ><input
                                type="checkbox"
                                name=${l}
                                .value=${$}
                                .checked=${b.includes($)}
                                ?disabled=${b.length >= 100 && !b.includes($)}
                                @change=${(Xt) => {
            this.draft = {
              ...this.draft,
              [l]: Xt.target.checked ? [...b, $] : b.filter(
                (Qt) => Qt !== $
              )
            }, this.requestUpdate();
          }}
                              />${l === "status" ? M[$] : $}</label
                            >`
        ) : r`<p class="muted">No matching options</p>`}
                </div>
              </fieldset>`;
      }
    )}
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
      const l = { ...this.applied };
      for (const u of [...at.map(([p]) => p), "status"])
        l[u] = this.draft[u] ?? [];
      this.applied = l, this.closeDialog("filter-dialog"), this.load();
    }}
          >
            Apply filters
          </button>
        </div>
      </dialog>
      <dialog
        id="title-dialog"
        @cancel=${(l) => {
      this.collectionLocked && l.preventDefault();
    }}
        @click=${R}
        class="database-dialog library-dialog"
        aria-labelledby="library-title"
        @close=${() => {
      this.selected = void 0, this.clearVersions(), this.requestUpdate();
    }}
      >
        ${a ? r`<div class="card-head">
                  <h2 id="library-title">
                    ${a.title}${a.year ? ` (${a.year})` : ""}
                  </h2>
                  <button
                    ?disabled=${this.collectionLocked}
                    @click=${() => this.closeDialog("title-dialog")}
                  >
                    Close
                  </button>
                </div>
                <p>
                  ${a.version_count ?? 1} version(s) · ${this.format(a)}
                </p>
                ${this.versionsLoading ? r`<p role="status">Loading individual versions…</p>` : h}
                ${this.versionsError ? r`<p class="error" role="alert">
                          ${this.versionsError}
                        </p>
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
      (l, u) => r`<button
                                ?disabled=${this.collectionLocked}
                                role="tab"
                                id=${`version-${u}`}
                                aria-controls="version-details"
                                tabindex=${l.id === n?.id ? 0 : -1}
                                aria-selected=${l.id === n?.id}
                                @click=${() => {
        this.activeVersion = l, this.requestUpdate();
      }}
                              >
                                ${this.format(l)} ·
                                ${l.year ?? "Year unknown"} · Version
                                ${this.versions.offset + u + 1}
                              </button>`
    )}
                        </div>
                        ${this.versions.total > 50 ? r`<div class="actions"><button ?disabled=${!this.versions.offset || this.versionsLoading} @click=${() => this.loadVersions(Math.max(0, this.versions.offset - 50))}>Previous versions</button><button ?disabled=${!this.versions.has_more || this.versionsLoading} @click=${() => this.loadVersions(this.versions.offset + 50)}>Next versions</button></div>` : h}` : h}
                ${n ? r`<div
                        class="playback-layout"
                        id="version-details"
                        role="tabpanel"
                        aria-labelledby=${`version-${this.versions?.items.findIndex((l) => l.id === n.id) ?? 0}`}
                      >
                        <div class="cover">${this.cover(n)}</div>
                        <div>
                          <p>${n.synopsis || "No synopsis available."}</p>
                          <p>
                            ${n.year ?? "Year unknown"} ·
                            ${n.rating || "Unrated"} · ${this.format(n)} ·
                            ${M[n.watched_status]}
                          </p>
                          <p>
                            ${n.duration_seconds === null ? "Runtime unknown" : `${(n.duration_seconds / 60).toFixed(2)} min`}
                          </p>
                          ${[
      ["Collections", n.collections],
      ["Cast", n.actors],
      ["Directors", n.directors],
      ["Genres", n.genres]
    ].map(
      ([l, u]) => u.length ? r`<p>
                                  <strong>${l}:</strong>
                                  ${u.join(", ")}
                                </p>` : h
    )}
                          <p class="muted">
                            ${n.purchased_on ? r`Purchased ${this.date(n.purchased_on)} · imported from purchase history.<br />` : h}
                            First detected ${this.date(n.first_seen)}.
                          </p>
                          ${d ? r`<kaleidescape-library-collection-add
                                  .client=${this.client}
                                  .scope=${this.scope}
                                  .version=${n}
                                  .revision=${this.versions?.revision ?? 0}
                                  .enabled=${!!this.info?.collection_add_enabled}
                                  .blocked=${!!this.info?.pending_adds?.length}
                                  @collection-lock=${(l) => {
      l.detail !== this.collectionLocked && (this.collectionLocked = l.detail, this.requestUpdate());
    }}
                                  @collection-changed=${(l) => {
      this.collectionLocked = !1, this.notice = l.detail.status === "confirmed" ? "Collection membership confirmed on the device." : "Check the pending collection add before making another change.", this.load(), this.refreshStatus();
    }}
                                ></kaleidescape-library-collection-add>` : h}
                        </div>
                      </div>` : h}` : h}
      </dialog>
    </section>`;
  }
};
W.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, W.styles = k;
let ct = W;
customElements.get("kaleidescape-library") || customElements.define("kaleidescape-library", ct);
const J = class J extends y {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.userKey = "", this.generation = 0, this.scope = null, this.rows = [], this.loading = !1, this.error = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.next = null, this.history = [], this.page = 1, this.activePage = "journal", this.navigationReady = !1;
  }
  willUpdate(t) {
    if (!(!t.has("hass") && !t.has("client")))
      if (this.hass) {
        const e = `${this.hass.user?.id}:${this.hass.user?.is_admin}`;
        !this.hass.user || !this.hass.connection.connected ? this.bind(null) : (this.connection !== this.hass.connection || this.userKey !== e || !this.api) && (this.connection = this.hass.connection, this.userKey = e, this.bind(
          new Wt({
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
  bind(t) {
    t !== this.api && (this.clear(), this.api = t, this.requestUpdate(), t && this.refresh());
  }
  fail(t) {
    f(t) === "unauthorized" && this.clear(), this.error = _(t), this.requestUpdate();
  }
  async refresh() {
    if (!this.api) return;
    const t = ++this.generation;
    this.scope = null, this.rows = [], this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const { entries: e } = await this.api.info();
      if (t !== this.generation) return;
      if (!e[0]?.permissions.read || e[0].api_version !== 1)
        throw new g("not_ready");
      if (this.scope = {
        ...e[0],
        permissions: { read: !0, edit: !1, export: !1 }
      }, !this.navigationReady) {
        const i = Gt(
          this.scope.ui_defaults?.default_landing_page,
          !1,
          !!this.scope.library_enabled
        );
        this.activePage = i === "library" ? "library" : "journal", this.navigationReady = !0;
      }
      this.scope.library_enabled || (this.activePage = "journal"), D(this.activePage), await this.load(void 0, t);
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
  selectPage(t) {
    t === "library" && !this.scope?.library_enabled || (this.activePage = t, D(t), this.requestUpdate());
  }
  tabKey(t) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(t.key)) return;
    t.preventDefault();
    const e = !this.scope?.library_enabled || t.key === "End" ? "journal" : t.key === "Home" || this.activePage === "journal" ? "library" : "journal";
    this.selectPage(e), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#reader-${e}`)?.focus()
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
        ${["library", "journal"].map((t) => r`<button id=${`reader-${t}`} role="tab" aria-controls="reader-content" aria-selected=${this.activePage === t} tabindex=${this.activePage === t ? 0 : -1} ?disabled=${t === "library" && !this.scope?.library_enabled} @click=${() => this.selectPage(t)}>${t === "journal" ? "Journal" : "Library"}</button>`)}
      </nav>
      <section
        id="reader-content"
        role="tabpanel"
        aria-labelledby=${`reader-${this.activePage}`}
      >
        ${this.activePage === "library" && this.scope ? r`<kaleidescape-library
                .client=${this.api ?? void 0}
                .scope=${this.scope}
                @access-denied=${() => this.fail(new g("unauthorized"))}
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
      (t) => r`<tr>
                                      <td>
                                        <strong>${t.title}</strong
                                        ><small
                                          >Started
                                          ${this.date(t.started_at)}<br />Ended
                                          ${this.date(t.ended_at)}</small
                                        >
                                      </td>
                                      <td>
                                        ${t.status === "completed" ? "Completed" : "Partial"}
                                      </td>
                                      <td>
                                        ${(t.watched_seconds / 60).toFixed(2)}
                                        min
                                      </td>
                                      <td>
                                        ${t.duration_seconds == null ? "—" : `${(t.duration_seconds / 60).toFixed(2)} min`}
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
J.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, J.styles = k;
let ut = J;
customElements.get("kaleidescape-reader") || customElements.define("kaleidescape-reader", ut);
const qe = {
  playing: "Playing",
  paused: "Paused",
  forward: "Scanning forward",
  reverse: "Scanning backward",
  stopped: "Stopped",
  none: "Stopped"
}, Ee = {
  content: "Main content",
  credits: "Credits",
  intermission: "Intermission",
  disc_menu: "Disc menu",
  none: "No active content"
}, K = class K extends y {
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
      const a = this.player, n = a?.available && a.artwork_key && a.entity_id ? `${a.entity_id}:${a.raw_content_id}:${a.artwork_key}` : "";
      if (n !== this.imageKey && (this.clearImage(), this.imageKey = n, this.requestUpdate(), n)) {
        const d = this.abort = new AbortController(), c = setTimeout(() => d.abort(), 5e3);
        try {
          const l = await t.artwork(
            a.entity_id,
            d.signal
          );
          i === this.generation && l && (this.image = URL.createObjectURL(l));
        } catch (l) {
          if (f(l) === "unauthorized") throw l;
        } finally {
          clearTimeout(c), this.abort === d && (this.abort = void 0);
        }
      }
    } catch (s) {
      if (i !== this.generation) return;
      this.player = null, this.clearImage(), this.denied = f(s) === "unauthorized", this.error = this.denied ? "Now Playing access is unavailable. Check your account and source permissions." : "Now Playing could not refresh. Check the connection or refresh again.";
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
                  ${t.available ? r`<p>${qe[t.play_status] ?? "Unknown playback state"} · ${Ee[t.location] ?? "Unknown location"}</p>` : h}
                  ${e && t.duration_seconds != null ? r`<p>Runtime · ${(t.duration_seconds / 60).toFixed(2)} min</p>` : h}
                  ${e && t.session ? r`<p>
                            This session ·
                            ${(t.session.watched_seconds / 60).toFixed(2)}
                            min counted
                          </p>
                          <small
                            >Pauses and scans are excluded.
                            ${t.session.credits_confirmed ? "Credits confirmed; journal completion also requires the configured watch threshold." : "Credits not yet confirmed."}
                            ${t.session.gap_count ? r` ${t.session.gap_count} timing gap(s).` : h}</small
                          >` : h}
                  <p role="status">
                    ${this.recordingStatus(t, !!e)}
                    ${t.buffered_observations ? r` ${t.buffered_observations} update(s) buffered.` : h}
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
K.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, K.styles = [
  k,
  Z`
      :host {
        min-height: 0;
      }
    `
];
let pt = K;
customElements.get("kaleidescape-now-playing") || customElements.define("kaleidescape-now-playing", pt);
const Ot = [
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
], jt = [
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
], Yt = [
  ["library_allow_collection_add", "Allow Add to Collection on the device"],
  ["library_sync_collections", "Sync collections and watched status"],
  ["library_sync_details", "Sync title details and credits"],
  ["library_sync_artwork", "Sync artwork"]
], Ue = /* @__PURE__ */ new Set([
  "tracking_enabled",
  "library_enabled",
  ...Yt.map(([o]) => o)
]), Ae = {
  invalid_display_options: "Choose a landing page, List or Covers, and a whole-number entry count from 1–1000.",
  missing_entities: "Select all three source entities to enable tracking.",
  invalid_entities: "Choose existing media_player and sensor entity IDs.",
  duplicate_entities: "Choose different sensors for play status and media location.",
  invalid_rules: "Check the runtime, completion, and partial-resume values.",
  invalid_library_host: "Enter a hostname or private LAN HTTP(S) origin without a path, credentials, or query.",
  invalid_library_collections: "Choose at most 200 collection names (256 characters each).",
  invalid_library_options: "Choose a sync interval of 1–168 hours and an artwork cache limit of 32–4096 MiB."
}, G = class G extends y {
  constructor() {
    super(...arguments), this.generation = 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.customCollection = "", this.loading = !1, this.saving = !1, this.uncertain = !1, this.error = "", this.bound = "";
  }
  willUpdate(t) {
    if (!t.has("client") && !t.has("scope")) return;
    const e = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    e === this.bound && this.client === this.boundClient || (this.cancelFlow(), this.bound = e, this.boundClient = this.client, this.boundScope = this.scope, this.flow = void 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.customCollection = "", this.uncertain = this.saving = !1, this.client && this.scope && this.start());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.cancelFlow(), this.flow = void 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.customCollection = "", this.bound = "", this.boundClient = void 0;
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  cancelFlow() {
    this.generation++, this.flow?.flow_id && this.boundClient && this.boundScope && this.boundClient.settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id }).catch(() => {
    });
  }
  fail(t) {
    this.error = _(t), f(t) === "unauthorized" && (this.flow = void 0, this.draft = {}, this.initial = {}, this.dispatchEvent(
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
      if (this.flow = s, this.draft = Object.fromEntries(
        (s.fields ?? []).map((a) => [
          a.name,
          a.name === "library_excluded_collections" ? Array.isArray(a.default) ? [...a.default] : String(a.default ?? "").split(`
`).filter(Boolean) : Ue.has(a.name) ? !!a.default : String(a.default ?? "")
        ])
      ), this.initial = { ...this.draft }, e.library_enabled) {
        const a = await t.libraryInfo(e);
        i === this.generation && (this.collectionChoices = a.collection_names ?? []);
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
  async save(t) {
    if (t.preventDefault(), !this.client || !this.scope || !this.flow?.flow_id || this.saving || this.uncertain || !t.target.reportValidity()) return;
    const e = this.generation;
    this.saving = !0, this.busy(), this.error = "", this.requestUpdate();
    const i = { ...this.draft };
    for (const [s, , a] of Ot)
      a === "number" ? i[s] = Number(i[s]) : i[s] || delete i[s];
    for (const [s, , a] of jt)
      a === "number" && (i[s] = Number(i[s]));
    i.library_host = String(i.library_host ?? ""), i.library_default_count = Number(i.library_default_count ?? 50);
    try {
      const s = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data: i
      });
      if (e !== this.generation) return;
      this.flow = s, s.type === "create_entry" ? (this.initial = { ...this.draft }, this.saving = !1, this.busy(), this.dispatchEvent(
        new CustomEvent("settings-saved", { bubbles: !0, composed: !0 })
      )) : s.type === "form" ? this.error = Object.values(s.errors ?? {}).map(
        (a) => Ae[a] ?? "Check the settings and try again."
      ).join(" ") : this.error = "The settings flow ended. Reload settings to continue.";
    } catch (s) {
      e === this.generation && (this.fail(s), this.uncertain = ![
        "unauthorized",
        "invalid_request",
        "conflict"
      ].includes(f(s)));
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
      ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}
      ${this.uncertain ? r`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : h}
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
                    ${Ot.map(
      ([t, e, i, s, a]) => r`<label class=${i === "text" ? "full" : ""}
                          >${e}<input
                            name=${t}
                            type=${i}
                            min=${s || h}
                            max=${a || h}
                            step=${i === "number" ? "1" : h}
                            maxlength=${i === "text" ? "255" : h}
                            ?required=${i === "number" || !!this.draft.tracking_enabled}
                            .value=${String(this.draft[t] ?? "")}
                            @input=${(n) => {
        this.draft = {
          ...this.draft,
          [t]: n.target.value
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
                    Optional synchronization with your local Kaleidescape
                    library. Disabled by default; no library discovery or device
                    requests occur while disabled.
                  </p>
                  ${this.draft.library_enabled ? r`<div class="grid settings-grid">
                            ${jt.map(
      ([t, e, i, s, a]) => r`<label
                                  class=${i === "text" ? "full" : ""}
                                  >${e}<input
                                    name=${t}
                                    type=${i}
                                    min=${s || h}
                                    max=${a || h}
                                    step=${i === "number" ? "1" : h}
                                    maxlength=${i === "text" ? "255" : h}
                                    ?required=${i === "number"}
                                    .value=${String(this.draft[t] ?? "")}
                                    @input=${(n) => {
        this.draft = {
          ...this.draft,
          [t]: n.target.value
        }, this.requestUpdate();
      }}
                                /></label>`
    )}
                            ${this.renderCollections()}
                            ${Yt.map(
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
                            Add to Collection is separately disabled by default.
                            Enabling it lets administrators add an explicitly
                            selected version to an existing offered collection.
                            It requires collection sync. Removal is not
                            supported.
                          </p>
                          <p class="muted">
                            Played means watched; Paused takes priority as
                            in-progress. Detail fields depend on available
                            source metadata. “Added on” means first detected,
                            not purchased or downloaded.
                          </p>
                          ${this.draft.library_sync_artwork ? r`<p class="warning">Artwork uses additional disk space in a separate private cache, up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. Increase the cache limit for a large library; older covers may be evicted and fetched again. HA backups can include these files.</p>` : h}` : h}
                  <h3>Display defaults</h3>
                  <div class="grid settings-grid">
                    ${[
      [
        "default_landing_page",
        "Default landing page",
        [
          ["now-playing", "Now Playing"],
          ["library", "Library"],
          ["journal", "Journal"],
          ["database", "Database"],
          ["settings", "Settings"]
        ]
      ],
      [
        "library_default_view",
        "Default Library view",
        [
          ["list", "List"],
          ["covers", "Covers"]
        ]
      ]
    ].map(
      ([t, e, i]) => r`<label
                          >${e}<select
                            name=${t}
                            .value=${String(this.draft[t] ?? (t === "default_landing_page" ? "journal" : "list"))}
                            @change=${(s) => {
        this.draft = {
          ...this.draft,
          [t]: s.target.value
        };
      }}
                          >
                            ${i.map(([s, a]) => r`<option value=${s}>${a}</option>`)}
                          </select></label
                        >`
    )}
                    <label
                      >Default Library entries per page<input
                        name="library_default_count"
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        required
                        .value=${String(this.draft.library_default_count ?? 50)}
                        @input=${(t) => {
      this.draft = {
        ...this.draft,
        library_default_count: t.target.value
      };
    }}
                    /></label>
                  </div>
                  <p class="muted">
                    The URL remembers your current tab across reloads. These
                    defaults apply to fresh visits. Regular users can land on
                    Journal or an enabled Library.
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
              </form>` : h}
    </section>`;
  }
  renderCollections() {
    const t = this.draft.library_excluded_collections ?? [], e = [.../* @__PURE__ */ new Set([...this.collectionChoices, ...t])].sort(
      (i, s) => i.localeCompare(s)
    );
    return r`<fieldset class="full">
      <legend>Hidden collection names</legend>
      <div class="facet-options">
        ${e.map(
      (i) => r`<label class="check"
              ><input
                name="library_excluded_collections"
                type="checkbox"
                .value=${i}
                .checked=${t.includes(i)}
                ?disabled=${t.length >= 200 && !t.includes(i)}
                @change=${(s) => {
        this.draft = {
          ...this.draft,
          library_excluded_collections: s.target.checked ? [...t, i] : t.filter((a) => a !== i)
        }, this.requestUpdate();
      }}
              />${i}</label
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
      !i || t.length >= 200 || (t.some(
        (s) => s.toLocaleLowerCase() === i.toLocaleLowerCase()
      ) || (this.draft = {
        ...this.draft,
        library_excluded_collections: [...t, i]
      }), this.customCollection = "", this.requestUpdate());
    }}
        >
          Add hidden name
        </button>
      </div>
      <small
        >Selected names are hidden from labels and filters. Movies remain
        visible; Played/Paused still determine status. No device changes.</small
      >
    </fieldset>`;
  }
};
G.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, G.styles = k;
let gt = G;
customElements.get("kaleidescape-settings") || customElements.define("kaleidescape-settings", gt);
const Y = class Y extends y {
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
    f(t) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = _(t), this.requestUpdate();
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
      const n = URL.createObjectURL(a), d = document.createElement("a");
      try {
        d.href = n, d.download = `kaleidescape-journal.${t}`, d.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(n), 1e3);
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
          ].includes(f(s)) && (this.pending = void 0), this.fail(s);
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
      ${!this.dialog && this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}
      ${!this.dialog && this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : h}
      <dialog
        class="database-dialog"
        @click=${R}
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : "Import viewings"}
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
                  ${this.scope?.tracking_enabled ? r`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : h}
                  <label
                    >JSON or SQLite export<input
                      type="file"
                      accept=".json,.sqlite,.sqlite3,.db"
                      ?disabled=${t || !!this.scope?.tracking_enabled}
                      @change=${(e) => {
      this.file = e.target.files?.[0], this.error = this.notice = "", this.requestUpdate();
    }}
                  /></label>
                  ${this.file ? r`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : h}
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
                        </div>` : h}` : h}
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
Y.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, Y.styles = [
  k,
  Z`
      :host {
        min-height: 0;
        background: transparent;
      }
    `
];
let ft = Y;
customElements.get("kaleidescape-transfers") || customElements.define("kaleidescape-transfers", ft);
const rt = {
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
  library_artwork: "Library artwork",
  library_purchase_dates: "Purchase dates",
  library_purchase_audit: "Purchase date audit",
  library_collection_intents: "Collection add requests"
}, X = class X extends y {
  constructor() {
    super(...arguments), this.bound = "", this.generation = 0, this.table = "viewings", this.filters = { limit: 25, query: "", descending: !1 }, this.search = "", this.columns = [], this.selected = /* @__PURE__ */ new Set(), this.confirming = null, this.confirmation = "", this.purgeOpen = !1, this.transferBusy = !1, this.detail = null, this.draft = null, this.initial = null, this.loading = !1, this.saving = !1, this.error = "", this.notice = "";
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
    this.generation++, this.page = void 0, this.table = "viewings", this.filters = { limit: 25, query: "", descending: !1 }, this.search = "", this.columns = [], this.selected.clear(), this.confirming = null, this.hidePurge(), this.confirmation = this.error = this.notice = "", this.pending = this.editPending = void 0, this.detail = this.draft = this.initial = null, this.transferBusy = !1, this.loading = this.saving = !1, this.busy();
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
    f(t) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = _(t), this.requestUpdate();
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
        e,
        this.filters
      );
      i === this.generation && (this.page = s, this.columns = s.columns, this.filters.sort = s.sort);
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
          ].includes(f(i)) && (this.pending = void 0), this.fail(i);
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
    this.discard() && (this.detail = t, this.draft = this.table === "viewings" ? L(t) : null, this.initial = this.draft ? { ...this.draft } : null, this.requestUpdate());
  }
  newEntry() {
    this.table !== "viewings" || this.loading || this.saving || this.pending || this.editPending || this.transferBusy || !this.discard() || (this.detail = null, this.draft = L(), this.initial = { ...this.draft }, this.error = this.notice = "", this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector("#title")?.focus()
    ));
  }
  async saveDetail(t) {
    if (t?.preventDefault(), !(!this.client || !this.scope || !this.draft || !this.initial || this.saving || this.pending || this.transferBusy) && !(t && !t.target.reportValidity()))
      try {
        if (!this.editPending) {
          const e = Jt(
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
      const a = this.page?.items.find((n) => n.id === i.viewing.id);
      this.showDetail(
        a ?? i.viewing
      );
    } catch (i) {
      if (e !== this.generation) return;
      ["invalid_request", "conflict", "unauthorized", "not_found"].includes(
        f(i)
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
        </div>` : h;
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
                ${Kt(this.draft, (e, i) => {
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
              <pre>${JSON.stringify(this.detail, null, 2)}</pre>` : h}`;
  }
  switchTable(t) {
    this.blocked || this.discard() && (this.table = t, this.filters = { limit: this.filters.limit, query: "", descending: !1 }, this.search = "", this.columns = [], this.draft = this.initial = null, this.load());
  }
  browse(t) {
    return this.blocked || !this.discard() ? !1 : (this.filters = { ...this.filters, ...t }, this.draft = this.initial = null, this.load(), !0);
  }
  tabKey(t, e) {
    const i = e.indexOf(this.table), s = t.key === "ArrowRight" ? (i + 1) % e.length : t.key === "ArrowLeft" ? (i + e.length - 1) % e.length : t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : -1;
    s < 0 || (t.preventDefault(), this.switchTable(e[s]), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#table-${this.table}`)?.focus()
    ));
  }
  render() {
    const t = this.blocked, e = Object.keys(this.page?.tables ?? rt), i = this.selected.size === 1 ? this.page?.items.find((a) => this.selected.has(String(a.id))) : void 0, s = this.table === "viewings";
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
        ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}
        ${this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : h}
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
              ${rt[a] ?? a}${this.page ? ` (${this.page.tables[a]})` : ""}
            </button>`
    )}
      </div>
      <form
        class="filters database-filters"
        @submit=${(a) => {
      a.preventDefault(), this.browse({ query: this.search });
    }}
      >
        <label
          >Search rows
          <input
            name="database_query"
            maxlength="500"
            .value=${this.search}
            ?disabled=${t}
            @input=${(a) => {
      this.search = a.target.value;
    }}
          />
        </label>
        <button type="submit" ?disabled=${t}>Search</button>
        <label
          >Rows per page
          <select
            name="database_limit"
            .value=${String(this.filters.limit)}
            ?disabled=${t}
            @change=${(a) => {
      const n = a.target;
      this.browse({ limit: Number(n.value) }) || (n.value = String(this.filters.limit));
    }}
          >
            ${[10, 25, 100, 500].map((a) => r`<option value=${a}>${a}</option>`)}
          </select>
        </label>
        <label
          >Sort by
          <select
            name="database_sort"
            .value=${this.filters.sort ?? this.columns[0] ?? ""}
            ?disabled=${t || !this.columns.length}
            @change=${(a) => {
      const n = a.target;
      this.browse({ sort: n.value }) || (n.value = this.filters.sort ?? this.columns[0] ?? "");
    }}
          >
            ${this.columns.map((a) => r`<option value=${a}>${a.replaceAll("_", " ")}</option>`)}
          </select>
        </label>
        <button
          type="button"
          ?disabled=${t}
          aria-label="Reverse database sort"
          @click=${() => this.browse({ descending: !this.filters.descending })}
        >
          ${this.filters.descending ? "Descending ↓" : "Ascending ↑"}
        </button>
      </form>
      <div
        class="database-layout"
        role="tabpanel"
        id="database-rows"
        aria-labelledby=${`table-${this.table}`}
      >
        <section class="database-entries" aria-label="Database entries">
          <div class="card-head">
            <h2>${rt[this.table] ?? this.table}</h2>
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
                                    ?disabled=${t || this.selected.size >= 100 && !this.selected.has(String(a.id))}
                                    .checked=${this.selected.has(String(a.id))}
                                    @change=${(n) => {
        if (n.target.checked) {
          if (this.selected.size >= 100) return;
          this.selected.add(String(a.id));
        } else
          this.selected.delete(String(a.id));
        this.confirming = null, this.requestUpdate();
      }}
                                  />` : h}
                            <button
                              class="link entry-name"
                              ?disabled=${t}
                              @click=${() => this.showDetail(a)}
                            >
                              ${String(a.title ?? a.id ?? a.request_id ?? "Dataset metadata")}
                              ${s ? r`<small>${a.deleted_at ? "Deleted" : "Visible"}</small>` : h}
                            </button>
                          </li>`
    )}
                    </ul>
                    ${this.page.items.length ? h : r`<p>No rows.</p>`}
                    <div class="pagination database-pagination">
                      <small
                        >Rows
                        ${this.page.items.length ? this.page.offset + 1 : 0}–${this.page.offset + this.page.items.length}
                        of ${this.page.total} · Up to ${this.page.limit}
                        rows${s ? ` · ${this.selected.size} selected (maximum 100)` : ""}</small
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
                          @click=${() => this.load(Math.max(0, this.page.offset - this.page.limit), this.page.revision)}
                        >
                          Previous
                        </button>
                        <button
                          ?disabled=${t || !this.page.has_more}
                          @click=${() => this.load(this.page.offset + this.page.limit, this.page.revision)}
                        >
                          Next
                        </button>
                      </div>
                    </div>` : h}
        </section>
        <section class="database-detail" aria-label="Selected database entry">
          ${this.renderDetail(t)}
        </section>
      </div>
      <dialog
        id="purge-dialog"
        @click=${R}
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
        ${this.scope?.tracking_enabled ? r`<p class="warning">Disable automatic tracking in Settings before purging.</p>` : h}
        ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}
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
              </div>` : h}
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
              </form>` : h}
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
X.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, X.styles = k;
let bt = X;
customElements.get("kaleidescape-advanced") || customElements.define("kaleidescape-advanced", bt);
const nt = [
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
], Q = class Q extends y {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.generation = 0, this.listRequest = 0, this.detailRequest = 0, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.nextCursor = null, this.history = [], this.page = 1, this.loading = !1, this.detailLoading = !1, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.error = "", this.lastError = "", this.notice = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = !1, this.maintenanceBusy = !1;
  }
  willUpdate(t) {
    if (!(!t.has("hass") && !t.has("client")))
      if (this.hass) {
        if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
          this.bind(null);
          return;
        }
        (this.haConnection !== this.hass.connection || this.haUser !== this.hass.user.id) && (this.haConnection = this.hass.connection, this.haUser = this.hass.user.id, this.haClient = new Wt({
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
    this.generation++, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.pending = null, this.history = [], this.nextCursor = null, this.cursor = void 0, this.page = 1, this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.confirmDelete = !1, this.saving = !1, this.loading = !1, this.detailLoading = !1, this.sessionError = "", this.notice = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = this.maintenanceBusy = !1;
  }
  bind(t) {
    this.api !== t && (this.clearPrivate(), this.api = t, this.error = "", this.requestUpdate(), t && this.refresh());
  }
  fail(t) {
    f(t) === "unauthorized" && this.clearPrivate(), this.lastError = f(t), this.error = _(t), this.requestUpdate();
  }
  dirty() {
    return this.draft && JSON.stringify(this.draft) !== JSON.stringify(this.initial);
  }
  discard() {
    return (!this.dirty() || window.confirm("Discard your unsaved changes?")) && (this.activePage !== "library" || (this.renderRoot.querySelector("kaleidescape-library")?.confirmNavigation() ?? !0)) && (this.activePage !== "database" || (this.renderRoot.querySelector("kaleidescape-advanced")?.confirmNavigation() ?? !0)) && (this.activePage !== "settings" || (this.renderRoot.querySelector("kaleidescape-settings")?.confirmNavigation() ?? !0));
  }
  async switchPage(t) {
    t === "library" && !this.info?.library_enabled || t === this.activePage || this.loading || this.saving || this.pending || this.maintenanceBusy || this.settingsBusy || !this.discard() || (this.closeEditor(), this.activePage = t, D(t), this.error = this.notice = "", this.requestUpdate(), t === "journal" && (this.page = 1, this.history = [], await this.loadList()));
  }
  pageKey(t) {
    const e = nt.filter(
      (n) => n.id !== "library" || this.info?.library_enabled
    ), i = e.findIndex((n) => n.id === this.activePage), s = t.key === "ArrowRight" ? (i + 1) % e.length : t.key === "ArrowLeft" ? (i + e.length - 1) % e.length : t.key === "Home" ? 0 : t.key === "End" ? e.length - 1 : -1;
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
        if (await new Promise((n) => setTimeout(n, 500)), i !== this.generation) return;
        ({ entries: s } = await e.info());
      }
      if (i !== this.generation) return;
      if (!s.length) throw new g("not_ready");
      if (s[0].api_version !== 1) throw new g("not_ready");
      if (this.info = s[0], !this.info.permissions.edit) return;
      this.navigationReady || (this.activePage = Gt(
        this.info.ui_defaults?.default_landing_page,
        !0,
        !!this.info.library_enabled
      ), this.navigationReady = !0, D(this.activePage)), this.activePage === "library" && !this.info.library_enabled && (this.activePage = "journal", D(this.activePage)), this.history = [], this.cursor = void 0, this.page = 1, await this.loadList();
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
      const n = await e.list(i, this.query, this.status, t);
      if (s !== this.generation || a !== this.listRequest)
        return;
      this.rows = n.items, this.cursor = t, this.nextCursor = n.next_cursor, this.info = { ...this.info, revision: n.revision };
    } catch (n) {
      s === this.generation && a === this.listRequest && (this.rows = [], this.nextCursor = null, this.fail(n));
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
      const n = await e.get(i, t);
      if (s !== this.generation || a !== this.detailRequest)
        return;
      this.selected = n, this.draft = L(n), this.initial = { ...this.draft }, this.detailLoading = !1, this.requestUpdate();
      try {
        const d = await e.sessions(i, t);
        s === this.generation && a === this.detailRequest && (this.sessions = d);
      } catch (d) {
        s === this.generation && a === this.detailRequest && (f(d) === "unauthorized" ? this.fail(d) : this.sessionError = "Session details could not be loaded.");
      }
    } catch (n) {
      s === this.generation && a === this.detailRequest && this.fail(n);
    } finally {
      s === this.generation && a === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  closeEditor() {
    this.detailRequest++, this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.confirmDelete = !1, this.detailLoading = !1;
  }
  newRecord() {
    this.pending || !this.discard() || (this.closeEditor(), this.draft = L(), this.initial = { ...this.draft }, this.error = "", this.notice = "", this.requestUpdate(), this.updateComplete.then(
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
        const i = Jt(
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
        f(i) === "request_id_unavailable" ? this.fail(i) : (this.error = "Check the dates and numeric fields before saving.", this.requestUpdate());
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
      this.pending = null, this.closeEditor(), this.notice = s.viewing.deleted_at ? "Entry removed from the journal. Stored history is retained." : "Entry saved.", s.viewing.deleted_at || (this.selected = s.viewing, this.draft = L(s.viewing), this.initial = { ...this.draft }), this.page = 1, this.history = [], await this.loadList();
      try {
        const { entries: a } = await t.info();
        i === this.generation && a[0]?.dataset_id === this.info?.dataset_id && (this.info = a[0]);
      } catch (a) {
        i === this.generation && this.fail(a);
      }
    } catch (s) {
      if (i !== this.generation) return;
      ["invalid_request", "conflict", "unauthorized"].includes(
        f(s)
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
        ${Kt(this.draft, (t, e) => this.input(t, e))}
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
              ${this.sessionError ? r`<p>${this.sessionError}</p>` : this.sessions ? this.sessions.items.length ? r` ${this.sessions.items.map((t) => r`<div class="session">${this.date(t.started_at)}<br />${(t.watched_seconds / 60).toFixed(2)} min watched · ${t.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${t.gap_count} timing gaps<br />${t.end_reason ?? "Open session"}</div>`)}
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
    const t = this.loading || this.saving || !!this.pending || this.maintenanceBusy || this.settingsBusy;
    return r`<main>
      <header>
        ${this.hass && this.narrow ? r`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : h}
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Kaleidescape Companion</h1>
          <p>
            ${nt.find((e) => e.id === this.activePage).description}
          </p>
        </div>
      </header>
      ${this.info?.permissions.edit ? r`<div
              class="page-tabs"
              role="tablist"
              aria-label="Companion pages"
              @keydown=${(e) => this.pageKey(e)}
            >
              ${nt.map((e) => r`<button id=${`page-${e.id}`} role="tab" aria-selected=${this.activePage === e.id} aria-controls="companion-page" tabindex=${this.activePage === e.id ? "0" : "-1"} ?disabled=${t || e.id === "library" && !this.info?.library_enabled} title=${e.id === "library" && !this.info?.library_enabled ? "Enable library sync in Settings" : h} @click=${() => this.switchPage(e.id)}>${e.label}</button>`)}
            </div>` : h}
      ${this.error ? r`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? r` <button ?disabled=${t} @click=${() => this.selectRecord(this.selected.id)}>Reload entry</button>` : h}</div>` : h}
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
                        @access-denied=${() => this.fail(new g("unauthorized"))}
                        @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
                      ></kaleidescape-library>` : this.activePage === "database" ? r`<kaleidescape-advanced
                          .client=${this.api}
                          .scope=${this.info}
                          @access-denied=${() => this.fail(new g("unauthorized"))}
                          @maintenance-busy=${(e) => {
      this.maintenanceBusy = e.detail, this.requestUpdate();
    }}
                          @database-changed=${() => this.refreshInfo()}
                        ></kaleidescape-advanced>` : this.activePage === "settings" ? r`<kaleidescape-settings
                            .client=${this.api}
                            .scope=${this.info}
                            @access-denied=${() => this.fail(new g("unauthorized"))}
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
Q.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, Q.styles = k;
let mt = Q;
customElements.get("kaleidescape-panel") || customElements.define("kaleidescape-panel", mt);
export {
  mt as KaleidescapePanel
};
