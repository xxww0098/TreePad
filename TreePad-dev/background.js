//#region src/shared/constants.ts
var e = "https://api.github.com", t = "treepad:", n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function r(e) {
	if (e.length === 0) return "";
	let t = Array(Math.ceil(e.length / 3)), r = 0;
	for (let i = 0; i < e.length; i += 3) {
		let a = e[i], o = i + 1 < e.length, s = i + 2 < e.length, c = o ? e[i + 1] : 0, l = s ? e[i + 2] : 0;
		t[r++] = n[a >> 2] + n[(a & 3) << 4 | c >> 4] + (o ? n[(c & 15) << 2 | l >> 6] : "=") + (s ? n[l & 63] : "=");
	}
	return t.join("");
}
function i(e) {
	return Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
}
function a(e) {
	return e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength);
}
//#endregion
//#region src/shared/github-api.ts
var o = class extends Error {
	status;
	rateLimit;
	constructor(e, t, n = null) {
		super(e), this.name = "GitHubApiError", this.status = t, this.rateLimit = n;
	}
};
function s(e) {
	let t = { Accept: "application/vnd.github+json" };
	return e.token && (t.Authorization = `Bearer ${e.token}`), t;
}
function c(e) {
	return e.token ? "token" : e.useCookieAuth ? "cookie" : "none";
}
function l(e, t = {}) {
	let n = t.headers ? Object.fromEntries(new Headers(t.headers).entries()) : {};
	return {
		...t,
		credentials: e.useCookieAuth ? "include" : "omit",
		headers: {
			...s(e),
			...n
		}
	};
}
function u(e) {
	if (e == null || e === "") return null;
	if (typeof e == "number") return Number.isFinite(e) ? e : null;
	let t = Number(e);
	return Number.isFinite(t) ? t : null;
}
function ee(e) {
	return e === null ? null : e * 1e3;
}
function d(e, t) {
	let n = u(e.get("x-ratelimit-limit")), r = u(e.get("x-ratelimit-remaining")), i = u(e.get("x-ratelimit-used")), a = ee(u(e.get("x-ratelimit-reset"))), o = e.get("x-ratelimit-resource");
	return n === null && r === null && i === null && a === null && !o ? null : {
		limit: n,
		remaining: r,
		used: i,
		resetAt: a,
		resource: o,
		authMode: t,
		detectedAsUnauthenticated: t !== "none" && n !== null && n <= 60
	};
}
function te(e) {
	return e?.resetAt ? ` Resets around ${new Date(e.resetAt).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	})}.` : "";
}
function ne(e, t) {
	let n = te(t);
	return e === "token" ? `This GitHub token has used up its API quota.${n}` : e === "cookie" ? t?.detectedAsUnauthenticated ? `You are signed into GitHub in the browser, but API requests are still anonymous. Connect with OAuth or a token in Settings.${n}` : `Your current GitHub browser session has used up its API quota. Connect GitHub with OAuth or a token in Settings.${n}` : `GitHub API quota is used up. Connect GitHub in Settings to raise the limit from 60 to 5,000 requests per hour.${n}`;
}
async function re(e) {
	try {
		let t = await e.clone().text();
		try {
			let e = JSON.parse(t);
			if (typeof e?.message == "string") return e.message;
		} catch {}
		return t.trim();
	} catch {
		return "";
	}
}
async function f(e, t, n) {
	let r = c(n), i = d(e.headers, r), a = await re(e), s = a.toLowerCase(), l = a ? ` — ${a}` : "";
	throw e.status === 401 && r === "token" ? new o("This GitHub token is invalid. Update it or remove it in Settings.", e.status, i) : e.status === 429 || s.includes("rate limit") || e.status === 403 && (i?.remaining === 0 || s.includes("abuse")) ? new o(ne(r, i), e.status, i) : e.status === 403 ? new o(`Access denied${l}`, e.status, i) : e.status === 401 && r === "cookie" ? new o("TreePad could not use your current GitHub browser session for API requests. Refresh GitHub, or connect with OAuth or a token in Settings.", e.status, i) : e.status === 401 ? new o("GitHub connection required. Connect GitHub in Settings.", e.status, i) : e.status === 404 && r === "token" ? new o("This repo or file could not be found. If it is private, make sure the connected GitHub account can access it.", e.status, i) : new o(`Failed to ${t}: ${e.status}${l}`, e.status, i);
}
function p(e) {
	return e.split("/").map((e) => encodeURIComponent(e)).join("/");
}
async function m(t = {}) {
	let n = c(t), r = await fetch(`${e}/rate_limit`, l(t));
	r.ok || await f(r, "fetch rate limit", t);
	let i = d(r.headers, n), a = (await r.json())?.resources?.core ?? {}, o = u(a.limit) ?? i?.limit ?? null;
	return {
		limit: o,
		remaining: u(a.remaining) ?? i?.remaining ?? null,
		used: u(a.used) ?? i?.used ?? null,
		resetAt: ee(u(a.reset)) ?? i?.resetAt ?? null,
		resource: "core",
		authMode: n,
		detectedAsUnauthenticated: n !== "none" && o !== null && o <= 60
	};
}
async function h(e) {
	return m({ token: e });
}
async function ie(t, n, r, i = {}) {
	let a = await fetch(`${e}/repos/${t}/${n}/commits/${encodeURIComponent(r)}`, l(i));
	a.ok || await f(a, "fetch commit", i);
	let o = (await a.json()).commit.tree.sha, s = await fetch(`${e}/repos/${t}/${n}/git/trees/${o}?recursive=1`, l(i));
	return s.ok || await f(s, "fetch tree", i), s.json();
}
async function ae(t, n, i, a, o = {}) {
	let s = `${e}/repos/${t}/${n}/contents/${p(a)}?ref=${encodeURIComponent(i)}`, c = await fetch(s, l(o, { headers: { Accept: "application/vnd.github.raw" } }));
	c.ok || await f(c, "fetch file", o);
	let u = await c.arrayBuffer();
	return r(new Uint8Array(u));
}
async function oe(t, n, r = {}) {
	let i = await fetch(`${e}/repos/${t}/${n}`, l(r));
	return i.ok || await f(i, "fetch repo", r), (await i.json()).default_branch;
}
async function se(t, n, r, i = {}) {
	let a = await fetch(`${e}/repos/${t}/${n}/git/matching-refs/heads/${p(r)}`, l(i));
	a.ok || await f(a, "fetch matching branches", i);
	let o = await a.json();
	return Array.isArray(o) ? o.map((e) => typeof e?.ref == "string" ? e.ref.replace(/^refs\/heads\//, "") : "").filter(Boolean) : [];
}
async function ce(t, n, r = {}, i = 1, a = 20) {
	let o = await fetch(`${e}/repos/${t}/${n}/releases?per_page=${a}&page=${i}`, l(r));
	return o.ok || await f(o, "fetch releases", r), o.json();
}
async function le(e, t = {}) {
	let n = await fetch(e, l(t, { headers: { Accept: "application/octet-stream" } }));
	n.ok || await f(n, "download release asset", t);
	let i = await n.arrayBuffer();
	return r(new Uint8Array(i));
}
//#endregion
//#region node_modules/idb-keyval/dist/index.js
function g(e) {
	return new Promise((t, n) => {
		e.oncomplete = e.onsuccess = () => t(e.result), e.onabort = e.onerror = () => n(e.error);
	});
}
function ue(e, t) {
	let n, r = () => {
		if (n) return n;
		let r = indexedDB.open(e);
		return r.onupgradeneeded = () => r.result.createObjectStore(t), n = g(r), n.then((e) => {
			e.onclose = () => n = void 0;
		}, () => {}), n;
	};
	return (e, n) => r().then((r) => n(r.transaction(t, e).objectStore(t)));
}
var _;
function v() {
	return _ ||= ue("keyval-store", "keyval"), _;
}
function de(e, t = v()) {
	return t("readonly", (t) => g(t.get(e)));
}
function fe(e, t, n = v()) {
	return n("readwrite", (n) => (n.put(t, e), g(n.transaction)));
}
function pe(e, t, n = v()) {
	return n("readwrite", (n) => new Promise((r, i) => {
		n.get(e).onsuccess = function() {
			try {
				n.put(t(this.result), e), r(g(n.transaction));
			} catch (e) {
				i(e);
			}
		};
	}));
}
function me(e, t = v()) {
	return t("readwrite", (t) => (t.delete(e), g(t.transaction)));
}
function he(e, t = v()) {
	return t("readwrite", (t) => (e.forEach((e) => t.delete(e)), g(t.transaction)));
}
//#endregion
//#region src/shared/cache.ts
var ge = 1e3 * 60 * 60 * 24 * 7, y = `${t}index:tree`, b = `${t}index:default-branch`;
function x(e, n, r) {
	return `${t}${e}/${n}:${r}`;
}
function S(e, n) {
	return `${t}default-branch:${e}/${n}`;
}
async function _e(e, t) {
	await pe(e, (e = {}) => {
		if (!(t in e)) return e;
		let n = { ...e };
		return delete n[t], n;
	});
}
async function C(e, t, n) {
	let r = [];
	await pe(e, (e = {}) => {
		let i = {
			...e,
			[t]: Date.now()
		}, a = Object.entries(i).sort((e, t) => t[1] - e[1]);
		return r = a.slice(n).map(([e]) => e), Object.fromEntries(a.slice(0, n));
	}), r.length && await he(r);
}
function w(e, t, n) {
	C(e, t, n).catch(() => {});
}
async function T(e, t) {
	await Promise.all([me(e), _e(t, e)]);
}
async function ve(e, t, n, r) {
	let i = x(e, t, n), a = await de(i);
	return a ? r && a.sha !== r || Date.now() - a.timestamp > 864e5 ? (await T(i, y), null) : (w(y, i, 24), a.nodes) : null;
}
async function ye(e, t, n, r, i) {
	let a = x(e, t, n);
	await fe(a, {
		sha: r,
		nodes: i,
		timestamp: Date.now()
	}), await C(y, a, 24);
}
async function be(e, t) {
	let n = S(e, t), r = await de(n);
	return r ? Date.now() - r.timestamp > ge ? (await T(n, b), null) : (w(b, n, 64), r.branch) : null;
}
async function xe(e, t, n) {
	let r = S(e, t);
	await fe(r, {
		branch: n,
		timestamp: Date.now()
	}), await C(b, r, 64);
}
//#endregion
//#region src/shared/tree-builder.ts
function E(e) {
	return "children" in e;
}
function Se(e) {
	let t = {
		name: "",
		path: "",
		children: /* @__PURE__ */ new Map()
	};
	for (let n of e) {
		let e = n.path.split("/"), r = t, i = "";
		for (let t = 0; t < e.length; t++) {
			let a = e[t], o = t === e.length - 1;
			if (i = i ? `${i}/${a}` : a, o && n.type === "blob") r.children.set(a, {
				name: a,
				path: n.path
			});
			else {
				let e = r.children.get(a);
				(!e || !E(e)) && (e = {
					name: a,
					path: i,
					children: /* @__PURE__ */ new Map()
				}, r.children.set(a, e)), r = e;
			}
		}
	}
	let n = [];
	function r(e, t, i) {
		let a = [...e.children.values()].sort((e, t) => {
			let n = E(e) ? 0 : 1, r = E(t) ? 0 : 1;
			return n === r ? e.name.localeCompare(t.name, void 0, { sensitivity: "base" }) : n - r;
		});
		for (let e of a) {
			let a = n.length;
			if (E(e)) {
				let o = {
					idx: a,
					name: e.name,
					path: e.path,
					depth: t,
					isDir: !0,
					parentIdx: i,
					childCount: 0,
					subtreeEnd: 0
				};
				n.push(o), r(e, t + 1, a), o.subtreeEnd = n.length, o.childCount = e.children.size;
			} else n.push({
				idx: a,
				name: e.name,
				path: e.path,
				depth: t,
				isDir: !1,
				parentIdx: i,
				childCount: 0,
				subtreeEnd: a + 1
			});
		}
	}
	return r(t, 0, -1), n;
}
//#endregion
//#region src/background/credential-store.ts
var D = "github_token_enc", O = "github_token_source", k = "ai_api_key_enc", A = "github_oauth_client_id", j = "credential_key_material_v2", M = "secure_credentials_v3", Ce = "", we = {
	githubToken: "github-token",
	aiKey: "ai-key"
}, N = 12;
function P(e) {
	return typeof e == "object" && !!e;
}
function Te() {
	return { version: 1 };
}
function F(e, t) {
	return P(e) ? e.version === 2 && e.kind === t && typeof e.iv == "string" && typeof e.ciphertext == "string" && typeof e.updatedAt == "number" : !1;
}
async function I() {
	let e = (await chrome.storage.local.get(M))[M];
	return !P(e) || e.version !== 1 ? Te() : {
		version: 1,
		githubToken: F(e.githubToken, "githubToken") ? e.githubToken : void 0,
		aiKey: F(e.aiKey, "aiKey") ? e.aiKey : void 0
	};
}
async function L(e) {
	await chrome.storage.local.set({ [M]: e });
}
var R = null;
async function z(e) {
	let t = new TextEncoder().encode(e), n = await crypto.subtle.importKey("raw", t, "PBKDF2", !1, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "PBKDF2",
		salt: new TextEncoder().encode("treepad-salt"),
		iterations: 1e5,
		hash: "SHA-256"
	}, n, {
		name: "AES-GCM",
		length: 256
	}, !1, ["encrypt", "decrypt"]);
}
async function B() {
	return R ||= (async () => {
		let e = (await chrome.storage.local.get(j))[j];
		if (typeof e == "string" && e.trim()) return e.trim();
		let t = r(crypto.getRandomValues(new Uint8Array(32)));
		return await chrome.storage.local.set({ [j]: t }), t;
	})(), R;
}
async function V(e) {
	return z(`${await B()}:${we[e]}:v2`);
}
async function Ee() {
	return z(await B());
}
async function De() {
	return z(chrome.runtime.id);
}
async function H(e, t, n = {}) {
	let i = await V(e), a = crypto.getRandomValues(new Uint8Array(12)), o = await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv: a
	}, i, new TextEncoder().encode(t));
	return {
		version: 2,
		kind: e,
		iv: r(a),
		ciphertext: r(new Uint8Array(o)),
		updatedAt: Date.now(),
		...n.source ? { source: n.source } : {},
		...n.migratedFrom ? { migratedFrom: n.migratedFrom } : {}
	};
}
async function U(e) {
	let t = await V(e.kind), n = a(i(e.iv)), r = a(i(e.ciphertext)), o = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: n
	}, t, r);
	return new TextDecoder().decode(o);
}
async function W(e, t) {
	let n = i(e), r = a(n.slice(0, N)), o = a(n.slice(N)), s = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: r
	}, t, o);
	return new TextDecoder().decode(s);
}
async function Oe(e) {
	try {
		return {
			value: await W(e, await Ee()),
			scheme: "install-key-v1"
		};
	} catch {
		return {
			value: await W(e, await De()),
			scheme: "runtime-id-v1"
		};
	}
}
async function G(e, t, n = {}) {
	let r = t.trim(), i = await I();
	r ? i[e] = await H(e, r, n) : delete i[e], await L(i);
}
async function ke(e) {
	let t = (await I())[e];
	if (t) try {
		return await U(t);
	} catch {
		console.warn(`[TreePad] Failed to decrypt ${e} — credential may be corrupted`);
		return;
	}
}
async function Ae() {
	let e = (await I()).githubToken;
	if (!e) return {
		token: void 0,
		source: void 0
	};
	try {
		return {
			token: await U(e),
			source: e.source
		};
	} catch {
		return console.warn("[TreePad] Failed to decrypt GitHub token"), {
			token: void 0,
			source: void 0
		};
	}
}
async function K(e, t = "manual") {
	if (!e.trim()) {
		await G("githubToken", "");
		return;
	}
	await G("githubToken", e, { source: t });
}
async function q() {
	return ke("aiKey");
}
async function je(e) {
	if (!e.trim()) {
		await G("aiKey", "");
		return;
	}
	await G("aiKey", e);
}
async function Me() {
	let e = (await chrome.storage.local.get(A))[A];
	return typeof e == "string" && e.trim() ? e.trim() : Ce.trim();
}
async function Ne(e) {
	let t = e.trim();
	if (!t) {
		await chrome.storage.local.remove(A);
		return;
	}
	await chrome.storage.local.set({ [A]: t });
}
async function Pe(e) {
	let t = (await chrome.storage.local.get(e))[e];
	if (typeof t != "string" || !t.trim()) return null;
	try {
		return await Oe(t);
	} catch {
		return null;
	}
}
async function Fe() {
	let e = (await chrome.storage.local.get(O))[O];
	if (e === "manual" || e === "oauth-device") return e;
}
async function Ie() {
	let e = await I(), t = !1;
	if (!e.githubToken) {
		let n = await Pe(D);
		if (n) {
			let r = await Fe();
			e.githubToken = await H("githubToken", n.value, {
				source: r ?? "manual",
				migratedFrom: n.scheme
			}), t = !0, console.info("[TreePad] Migrated legacy GitHub token to v2 store");
		}
	}
	if (!e.aiKey) {
		let n = await Pe(k);
		n && (e.aiKey = await H("aiKey", n.value, { migratedFrom: n.scheme }), t = !0, console.info("[TreePad] Migrated legacy AI key to v2 store"));
	}
	t && await L(e), await chrome.storage.local.remove([
		D,
		O,
		k
	]);
}
async function Le() {
	let e = await I();
	for (let t of ["githubToken", "aiKey"]) {
		let n = e[t];
		if (n) try {
			await U(n), console.info(`[TreePad] ✓ ${t} is readable`);
		} catch {
			console.warn(`[TreePad] ✗ ${t} is stored but cannot be decrypted — it may need to be re-entered`);
		}
	}
}
//#endregion
//#region src/background/index.ts
var Re = "urn:ietf:params:oauth:grant-type:device_code", ze = "https://github.com/login/device/code", Be = "https://github.com/login/oauth/access_token", Ve = 15e3, J = /* @__PURE__ */ new Map(), Y = /* @__PURE__ */ new Map();
function He(e) {
	return e.replace(/\/+$/, "") + "/chat/completions";
}
chrome.runtime.onInstalled.addListener(async (e) => {
	if (e.reason === "install" || e.reason === "update") {
		console.info(`[TreePad] Extension ${e.reason} — running credential migration`);
		try {
			await Ie(), await Le();
		} catch (e) {
			console.warn("[TreePad] Post-install migration error:", e);
		}
	}
});
function X(e) {
	return e.token ? `token:${e.token.slice(-12)}` : e.useCookieAuth ? "cookie" : "none";
}
function Z(e, t) {
	Y.set(X(e), {
		info: t,
		fetchedAt: Date.now()
	});
}
function Ue(e) {
	return Y.get(X(e))?.info ?? null;
}
function Q(e) {
	let t = Y.get(X(e));
	return t ? Date.now() - t.fetchedAt < Ve ? !0 : We(t.info) : !1;
}
function We(e) {
	return e.remaining === 0 && !!e.resetAt && e.resetAt > Date.now();
}
async function Ge(e) {
	let t = Y.get(X(e));
	if (!(!t || !Q(e)) && We(t.info)) throw Error(ne(t.info.authMode, t.info));
}
function Ke(e, t) {
	let n = J.get(e);
	if (n) return n;
	let r = t().finally(() => {
		J.delete(e);
	});
	return J.set(e, r), r;
}
function qe(e) {
	return e instanceof Error && e.message ? e.message : "Unknown error";
}
async function Je(e, t) {
	if (t instanceof o && t.rateLimit) {
		Z(e, t.rateLimit);
		return;
	}
	if (!Q(e)) try {
		Z(e, await m(e));
	} catch {}
}
async function Ye() {
	let e = [
		"user_session",
		"__Host-user_session_same_site",
		"logged_in",
		"_gh_sess"
	];
	try {
		return (await Promise.all(e.map((e) => chrome.cookies.get({
			url: "https://github.com/",
			name: e
		})))).some((e) => !!e?.value);
	} catch {
		return !1;
	}
}
async function Xe() {
	let { token: e, source: t } = await Ae();
	return e ? {
		token: e,
		tokenSource: t
	} : await Ye() ? { useCookieAuth: !0 } : {};
}
async function Ze(e = !1) {
	let t = await Xe(), n = await Me(), r = !!t.token, i = r ? t.tokenSource ?? "manual" : null, a = Ue(t);
	if (e || !a || !Q(t)) try {
		a = await m(t), Z(t, a);
	} catch (e) {
		e instanceof o && e.rateLimit && (a = e.rateLimit, Z(t, e.rateLimit));
	}
	return {
		authMode: c(t),
		tokenSource: i,
		hasToken: r,
		rateLimit: a ?? null,
		oauthClientId: n
	};
}
async function Qe(e) {
	let t = e.trim();
	if (!t) {
		await K("", "manual");
		return;
	}
	let n = await h(t);
	Z({
		token: t,
		tokenSource: "manual"
	}, n), await K(t, "manual");
}
async function $e(e) {
	let t = e?.trim();
	if (t) return await Ne(t), t;
	let n = await Me();
	if (n) return n;
	throw Error("GitHub OAuth is not configured for this build yet. Use the token flow, or add a client ID in advanced settings.");
}
async function et(e) {
	try {
		return await e.json();
	} catch {
		return {};
	}
}
async function tt(e) {
	let t = new URLSearchParams({ client_id: e }), n = await fetch(ze, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: t
	}), r = await et(n);
	if (!n.ok) throw Error(r.error_description || r.error || `Failed to start GitHub OAuth: ${n.status}`);
	if (typeof r.device_code != "string" || typeof r.user_code != "string" || typeof r.verification_uri != "string") throw Error("GitHub OAuth did not return a valid device code.");
	return {
		deviceCode: r.device_code,
		userCode: r.user_code,
		verificationUri: r.verification_uri,
		expiresIn: typeof r.expires_in == "number" ? r.expires_in : 900,
		interval: typeof r.interval == "number" ? r.interval : 5
	};
}
async function nt(e, t) {
	let n = new URLSearchParams({
		client_id: e,
		device_code: t,
		grant_type: Re
	}), r = await fetch(Be, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: n
	}), i = await et(r);
	return typeof i.access_token == "string" ? {
		status: "success",
		accessToken: i.access_token
	} : i.error === "authorization_pending" ? { status: "pending" } : i.error === "slow_down" ? {
		status: "slow_down",
		interval: 10
	} : i.error === "access_denied" ? {
		status: "error",
		error: "GitHub authorization was denied."
	} : i.error === "expired_token" ? {
		status: "error",
		error: "The GitHub device code expired. Start sign-in again."
	} : {
		status: "error",
		error: i.error_description || i.error || `GitHub OAuth failed: ${r.status}`
	};
}
async function rt(e) {
	let t = await $e(e);
	return {
		clientId: t,
		flow: await tt(t)
	};
}
async function it(e, t) {
	let n = await nt(await $e(t), e);
	if (n.status === "success" && n.accessToken) {
		let e = await h(n.accessToken);
		Z({
			token: n.accessToken,
			tokenSource: "oauth-device"
		}, e), await K(n.accessToken, "oauth-device");
	}
	return n;
}
async function $(e, t) {
	let n = await Xe();
	await Ge(n);
	try {
		return await Ke(e, () => t(n));
	} catch (e) {
		throw await Je(n, e), e;
	}
}
async function at(e) {
	await je(e);
}
async function ot(e, t, n) {
	let r = await q();
	if (!r) throw Error("AI API key not configured");
	let i = He(e), a = await fetch(i, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${r}`
		},
		body: JSON.stringify({
			model: t,
			messages: n
		})
	});
	if (!a.ok) {
		let e = await a.text().catch(() => "");
		throw Error(`AI API error ${a.status}: ${e.slice(0, 200)}`);
	}
	return (await a.json()).choices?.[0]?.message?.content ?? "";
}
var st = {
	FETCH_TREE: (e) => dt(e.owner, e.repo, e.branch),
	FETCH_BRANCHES: (e) => ct(e.owner, e.repo).then((e) => ({ branch: e })),
	FETCH_BRANCH_MATCHES: (e) => ut(e.owner, e.repo, e.prefix).then((e) => ({ branches: e })),
	FETCH_RAW: (e) => lt(e.owner, e.repo, e.branch, e.path).then((e) => ({ base64: e })),
	FETCH_RELEASES: (e) => ft(e.owner, e.repo, e.page, e.perPage).then((e) => ({ releases: e })),
	FETCH_RELEASE_ASSET: (e) => pt(e.url).then((e) => ({ base64: e })),
	SET_TOKEN: (e) => Qe(e.token).then(() => ({ ok: !0 })),
	GET_TOKEN: () => Ae().then(({ token: e, source: t }) => ({
		token: e ? "••••" : "",
		source: t ?? null
	})),
	GET_GITHUB_AUTH_STATUS: (e) => Ze(e.force).then((e) => ({ status: e })),
	SET_GITHUB_OAUTH_CLIENT_ID: (e) => Ne(e.clientId).then(() => ({ ok: !0 })),
	START_GITHUB_DEVICE_FLOW: (e) => rt(e.clientId),
	POLL_GITHUB_DEVICE_FLOW: (e) => it(e.deviceCode, e.clientId),
	SET_AI_KEY: (e) => at(e.key).then(() => ({ ok: !0 })),
	GET_AI_KEY: () => q().then((e) => ({ key: e ? "••••" : "" })),
	AI_CHAT: (e) => ot(e.baseUrl, e.model, e.messages).then((e) => ({ content: e }))
};
chrome.runtime.onMessage.addListener((e, t, n) => {
	let r = st[e.type];
	if (r) return r(e).then(n).catch((e) => n({ error: qe(e) })), !0;
}), chrome.runtime.onConnect.addListener((e) => {
	e.name === "ai-stream" && e.onMessage.addListener(async (t) => {
		if (t.type === "AI_CHAT_STREAM") try {
			let n = await q();
			if (!n) {
				e.postMessage({
					type: "error",
					error: "AI API key not configured"
				});
				return;
			}
			let r = He(t.baseUrl), i = await fetch(r, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${n}`
				},
				body: JSON.stringify({
					model: t.model,
					messages: t.messages,
					stream: !0
				})
			});
			if (!i.ok) {
				let t = await i.text().catch(() => "");
				e.postMessage({
					type: "error",
					error: `AI API error ${i.status}: ${t.slice(0, 200)}`
				});
				return;
			}
			let a = i.body.getReader(), o = new TextDecoder(), s = "";
			for (;;) {
				let { done: t, value: n } = await a.read();
				if (t) break;
				s += o.decode(n, { stream: !0 });
				let r = s.split("\n");
				s = r.pop() || "";
				for (let t of r) {
					let n = t.trim();
					if (!n || !n.startsWith("data: ")) continue;
					let r = n.slice(6);
					if (r !== "[DONE]") try {
						let t = JSON.parse(r).choices?.[0]?.delta?.content;
						if (t) try {
							e.postMessage({
								type: "chunk",
								content: t
							});
						} catch {
							return;
						}
					} catch {}
				}
			}
			e.postMessage({ type: "done" });
		} catch (t) {
			try {
				e.postMessage({
					type: "error",
					error: t.message || "Stream failed"
				});
			} catch {}
		}
	});
});
async function ct(e, t) {
	return await be(e, t) || $(`branch:${e}/${t}`, async (n) => {
		let r = await oe(e, t, n);
		return await xe(e, t, r), r;
	});
}
async function lt(e, t, n, r) {
	return $(`raw:${e}/${t}:${n}:${r}`, (i) => ae(e, t, n, r, i));
}
async function ut(e, t, n) {
	return $(`matching-refs:${e}/${t}:${n}`, (r) => se(e, t, n, r));
}
async function dt(e, t, n) {
	let r = await ve(e, t, n);
	return r ? {
		nodes: r,
		truncated: !1
	} : $(`tree:${e}/${t}:${n}`, async (r) => {
		let i = await ie(e, t, n, r), a = Se(i.tree);
		return await ye(e, t, n, i.sha, a), {
			nodes: a,
			truncated: i.truncated
		};
	});
}
async function ft(e, t, n, r) {
	return $(`releases:${e}/${t}:${n ?? 1}`, (i) => ce(e, t, i, n ?? 1, r ?? 20));
}
async function pt(e) {
	return $(`release-asset:${e}`, (t) => le(e, t));
}
//#endregion
