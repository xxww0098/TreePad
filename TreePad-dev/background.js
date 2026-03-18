//#region src/shared/constants.ts
var e = "https://api.github.com", t = "treepad:", n = class extends Error {
	status;
	rateLimit;
	constructor(e, t, n = null) {
		super(e), this.name = "GitHubApiError", this.status = t, this.rateLimit = n;
	}
};
function r(e) {
	let t = { Accept: "application/vnd.github+json" };
	return e.token && (t.Authorization = `Bearer ${e.token}`), t;
}
function i(e) {
	return e.token ? "token" : e.useCookieAuth ? "cookie" : "none";
}
function a(e, t = {}) {
	let n = t.headers ? Object.fromEntries(new Headers(t.headers).entries()) : {};
	return {
		...t,
		credentials: e.useCookieAuth ? "include" : "omit",
		headers: {
			...r(e),
			...n
		}
	};
}
function o(e) {
	if (!e) return null;
	let t = Number(e);
	return Number.isFinite(t) ? t : null;
}
function s(e) {
	return e === null ? null : e * 1e3;
}
function c(e, t) {
	let n = o(e.get("x-ratelimit-limit")), r = o(e.get("x-ratelimit-remaining")), i = o(e.get("x-ratelimit-used")), a = s(o(e.get("x-ratelimit-reset"))), c = e.get("x-ratelimit-resource");
	return n === null && r === null && i === null && a === null && !c ? null : {
		limit: n,
		remaining: r,
		used: i,
		resetAt: a,
		resource: c,
		authMode: t,
		detectedAsUnauthenticated: t !== "none" && n !== null && n <= 60
	};
}
function l(e) {
	return e?.resetAt ? ` Resets around ${new Date(e.resetAt).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	})}.` : "";
}
function u(e, t) {
	let n = l(t);
	return e === "token" ? `This GitHub token has used up its API quota.${n}` : e === "cookie" ? t?.detectedAsUnauthenticated ? `You are signed into GitHub in the browser, but API requests are still anonymous. Connect with OAuth or a token in Settings.${n}` : `Your current GitHub browser session has used up its API quota. Connect GitHub with OAuth or a token in Settings.${n}` : `GitHub API quota is used up. Connect GitHub in Settings to raise the limit from 60 to 5,000 requests per hour.${n}`;
}
async function ee(e) {
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
async function d(e, t, r) {
	let a = i(r), o = c(e.headers, a), s = await ee(e), l = s.toLowerCase();
	if (e.status === 401 && a === "token") throw new n("This GitHub token is invalid. Update it or remove it in Settings.", e.status, o);
	if (e.status === 429 || l.includes("rate limit") || e.status === 403 && (o?.remaining === 0 || l.includes("abuse"))) throw new n(u(a, o), e.status, o);
	if (e.status === 403) throw new n(`Access denied${s ? ` — ${s}` : ""}`, e.status, o);
	if (e.status === 401 && a === "cookie") throw new n("TreePad could not use your current GitHub browser session for API requests. Refresh GitHub, or connect with OAuth or a token in Settings.", e.status, o);
	if (e.status === 401) throw new n("GitHub connection required. Connect GitHub in Settings.", e.status, o);
	if (e.status === 404 && a === "token") throw new n("This repo or file could not be found. If it is private, make sure the connected GitHub account can access it.", e.status, o);
	let d = s ? ` — ${s}` : "";
	throw new n(`Failed to ${t}: ${e.status}${d}`, e.status, o);
}
function te(e) {
	return e.split("/").map((e) => encodeURIComponent(e)).join("/");
}
function f(e) {
	return typeof e == "number" && Number.isFinite(e) ? e : null;
}
async function p(t = {}) {
	let n = i(t), r = await fetch(`${e}/rate_limit`, a(t));
	r.ok || await d(r, "fetch rate limit", t);
	let o = c(r.headers, n), l = (await r.json())?.resources?.core ?? {}, u = f(l.limit) ?? o?.limit ?? null;
	return {
		limit: u,
		remaining: f(l.remaining) ?? o?.remaining ?? null,
		used: f(l.used) ?? o?.used ?? null,
		resetAt: s(f(l.reset)) ?? o?.resetAt ?? null,
		resource: "core",
		authMode: n,
		detectedAsUnauthenticated: n !== "none" && u !== null && u <= 60
	};
}
async function ne(e) {
	return p({ token: e });
}
async function re(t, n, r, i = {}) {
	let o = await fetch(`${e}/repos/${t}/${n}/commits/${encodeURIComponent(r)}`, a(i));
	o.ok || await d(o, "fetch commit", i);
	let s = (await o.json()).commit.tree.sha, c = await fetch(`${e}/repos/${t}/${n}/git/trees/${s}?recursive=1`, a(i));
	return c.ok || await d(c, "fetch tree", i), c.json();
}
async function ie(t, n, r, i, o = {}) {
	let s = `${e}/repos/${t}/${n}/contents/${te(i)}?ref=${encodeURIComponent(r)}`, c = await fetch(s, a(o, { headers: { Accept: "application/vnd.github.raw" } }));
	c.ok || await d(c, "fetch file", o);
	let l = await c.arrayBuffer(), u = new Uint8Array(l);
	return btoa(String.fromCharCode(...u));
}
async function ae(t, n, r = {}) {
	let i = await fetch(`${e}/repos/${t}/${n}`, a(r));
	return i.ok || await d(i, "fetch repo", r), (await i.json()).default_branch;
}
//#endregion
//#region node_modules/idb-keyval/dist/index.js
function m(e) {
	return new Promise((t, n) => {
		e.oncomplete = e.onsuccess = () => t(e.result), e.onabort = e.onerror = () => n(e.error);
	});
}
function oe(e, t) {
	let n, r = () => {
		if (n) return n;
		let r = indexedDB.open(e);
		return r.onupgradeneeded = () => r.result.createObjectStore(t), n = m(r), n.then((e) => {
			e.onclose = () => n = void 0;
		}, () => {}), n;
	};
	return (e, n) => r().then((r) => n(r.transaction(t, e).objectStore(t)));
}
var h;
function g() {
	return h ||= oe("keyval-store", "keyval"), h;
}
function _(e, t = g()) {
	return t("readonly", (t) => m(t.get(e)));
}
function v(e, t, n = g()) {
	return n("readwrite", (n) => (n.put(t, e), m(n.transaction)));
}
function y(e, t = g()) {
	return t("readwrite", (t) => (t.delete(e), m(t.transaction)));
}
//#endregion
//#region src/shared/cache.ts
var se = 1e3 * 60 * 60 * 24 * 7;
function b(e, n, r) {
	return `${t}${e}/${n}:${r}`;
}
function x(e, n) {
	return `${t}default-branch:${e}/${n}`;
}
async function ce(e, t, n, r) {
	let i = b(e, t, n), a = await _(i);
	return a ? r && a.sha !== r || Date.now() - a.timestamp > 864e5 ? (await y(i), null) : a.nodes : null;
}
async function le(e, t, n, r, i) {
	await v(b(e, t, n), {
		sha: r,
		nodes: i,
		timestamp: Date.now()
	});
}
async function ue(e, t) {
	let n = await _(x(e, t));
	return n ? Date.now() - n.timestamp > se ? (await y(x(e, t)), null) : n.branch : null;
}
async function de(e, t, n) {
	await v(x(e, t), {
		branch: n,
		timestamp: Date.now()
	});
}
//#endregion
//#region src/shared/tree-builder.ts
function S(e) {
	return "children" in e;
}
function fe(e) {
	let t = {
		name: "",
		path: "",
		children: /* @__PURE__ */ new Map()
	};
	for (let n of e) {
		let e = n.path.split("/"), r = t;
		for (let t = 0; t < e.length; t++) {
			let i = e[t];
			if (t === e.length - 1 && n.type === "blob") r.children.set(i, {
				name: i,
				path: n.path
			});
			else {
				let n = r.children.get(i);
				(!n || !S(n)) && (n = {
					name: i,
					path: e.slice(0, t + 1).join("/"),
					children: /* @__PURE__ */ new Map()
				}, r.children.set(i, n)), r = n;
			}
		}
	}
	let n = [];
	function r(e, t, i) {
		let a = [...e.children.values()].sort((e, t) => {
			let n = S(e) ? 0 : 1, r = S(t) ? 0 : 1;
			return n === r ? e.name.localeCompare(t.name, void 0, { sensitivity: "base" }) : n - r;
		});
		for (let e of a) {
			let a = n.length;
			if (S(e)) {
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
				n.push(o), r(e, t + 1, a), o.subtreeEnd = n.length, o.childCount = [...e.children.values()].length;
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
var pe = "github_token_enc", C = "github_token_source", w = "ai_api_key_enc", T = "github_oauth_client_id", E = "credential_key_material_v2", D = "secure_credentials_v3", me = "", he = {
	githubToken: "github-token",
	aiKey: "ai-key"
};
function O(e) {
	return typeof e == "object" && !!e;
}
function ge() {
	return { version: 1 };
}
function k(e) {
	let t = "";
	for (let n of e) t += String.fromCharCode(n);
	return btoa(t);
}
function A(e) {
	let t = Uint8Array.from(atob(e), (e) => e.charCodeAt(0)), n = new ArrayBuffer(t.byteLength);
	return new Uint8Array(n).set(t), new Uint8Array(n);
}
function j(e) {
	let t = new ArrayBuffer(e.byteLength);
	return new Uint8Array(t).set(e), t;
}
function M(e, t) {
	return O(e) ? e.version === 2 && e.kind === t && typeof e.iv == "string" && typeof e.ciphertext == "string" && typeof e.updatedAt == "number" : !1;
}
async function N() {
	let e = (await chrome.storage.local.get(D))[D];
	return !O(e) || e.version !== 1 ? ge() : {
		version: 1,
		githubToken: M(e.githubToken, "githubToken") ? e.githubToken : void 0,
		aiKey: M(e.aiKey, "aiKey") ? e.aiKey : void 0
	};
}
async function P(e) {
	await chrome.storage.local.set({ [D]: e });
}
var F = null;
async function I(e) {
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
async function L() {
	return F ||= (async () => {
		let e = (await chrome.storage.local.get(E))[E];
		if (typeof e == "string" && e.trim()) return e.trim();
		let t = crypto.getRandomValues(new Uint8Array(32)), n = btoa(String.fromCharCode(...t));
		return await chrome.storage.local.set({ [E]: n }), n;
	})(), F;
}
async function R(e) {
	return I(`${await L()}:${he[e]}:v2`);
}
async function _e() {
	return I(await L());
}
async function ve() {
	return I(chrome.runtime.id);
}
async function z(e, t, n = {}) {
	let r = await R(e), i = crypto.getRandomValues(new Uint8Array(12)), a = await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv: i
	}, r, new TextEncoder().encode(t));
	return {
		version: 2,
		kind: e,
		iv: k(i),
		ciphertext: k(new Uint8Array(a)),
		updatedAt: Date.now(),
		...n.source ? { source: n.source } : {},
		...n.migratedFrom ? { migratedFrom: n.migratedFrom } : {}
	};
}
async function B(e) {
	let t = await R(e.kind), n = j(A(e.iv)), r = j(A(e.ciphertext)), i = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: n
	}, t, r);
	return new TextDecoder().decode(i);
}
async function V(e, t) {
	let n = A(e), r = j(n.slice(0, 12)), i = j(n.slice(12)), a = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: r
	}, t, i);
	return new TextDecoder().decode(a);
}
async function ye(e) {
	try {
		return {
			value: await V(e, await _e()),
			scheme: "install-key-v1"
		};
	} catch {
		return {
			value: await V(e, await ve()),
			scheme: "runtime-id-v1"
		};
	}
}
async function H(e, t, n = {}) {
	let r = t.trim(), i = await N();
	r ? i[e] = await z(e, r, n) : delete i[e], await P(i);
}
async function be(e) {
	let t = (await N())[e];
	if (t) try {
		return await B(t);
	} catch {
		console.warn(`[TreePad] Failed to decrypt ${e} — credential may be corrupted`);
		return;
	}
}
async function U() {
	let e = (await N()).githubToken;
	if (!e) return {
		token: void 0,
		source: void 0
	};
	try {
		return {
			token: await B(e),
			source: e.source
		};
	} catch {
		return console.warn("[TreePad] Failed to decrypt GitHub token"), {
			token: void 0,
			source: void 0
		};
	}
}
async function xe() {
	let { token: e } = await U();
	return e;
}
async function Se() {
	let { source: e } = await U();
	return e;
}
async function W(e, t = "manual") {
	if (!e.trim()) {
		await H("githubToken", "");
		return;
	}
	await H("githubToken", e, { source: t });
}
async function G() {
	return be("aiKey");
}
async function Ce(e) {
	if (!e.trim()) {
		await H("aiKey", "");
		return;
	}
	await H("aiKey", e);
}
async function we() {
	let e = (await chrome.storage.local.get(T))[T];
	return typeof e == "string" && e.trim() ? e.trim() : me.trim();
}
async function Te(e) {
	let t = e.trim();
	if (!t) {
		await chrome.storage.local.remove(T);
		return;
	}
	await chrome.storage.local.set({ [T]: t });
}
async function Ee(e) {
	let t = (await chrome.storage.local.get(e))[e];
	if (typeof t != "string" || !t.trim()) return null;
	try {
		return await ye(t);
	} catch {
		return null;
	}
}
async function De() {
	let e = (await chrome.storage.local.get(C))[C];
	if (e === "manual" || e === "oauth-device") return e;
}
async function Oe() {
	let e = await N(), t = !1;
	if (!e.githubToken) {
		let n = await Ee(pe);
		if (n) {
			let r = await De();
			e.githubToken = await z("githubToken", n.value, {
				source: r ?? "manual",
				migratedFrom: n.scheme
			}), t = !0, console.info("[TreePad] Migrated legacy GitHub token to v2 store");
		}
	}
	if (!e.aiKey) {
		let n = await Ee(w);
		n && (e.aiKey = await z("aiKey", n.value, { migratedFrom: n.scheme }), t = !0, console.info("[TreePad] Migrated legacy AI key to v2 store"));
	}
	t && await P(e), await chrome.storage.local.remove([
		pe,
		C,
		w
	]);
}
async function ke() {
	let e = await N();
	for (let t of ["githubToken", "aiKey"]) {
		let n = e[t];
		if (n) try {
			await B(n), console.info(`[TreePad] ✓ ${t} is readable`);
		} catch {
			console.warn(`[TreePad] ✗ ${t} is stored but cannot be decrypted — it may need to be re-entered`);
		}
	}
}
//#endregion
//#region src/background/index.ts
var Ae = "urn:ietf:params:oauth:grant-type:device_code", je = "https://github.com/login/device/code", Me = "https://github.com/login/oauth/access_token", Ne = 15e3, K = /* @__PURE__ */ new Map(), q = /* @__PURE__ */ new Map();
chrome.runtime.onInstalled.addListener(async (e) => {
	if (e.reason === "install" || e.reason === "update") {
		console.info(`[TreePad] Extension ${e.reason} — running credential migration`);
		try {
			await Oe(), await ke();
		} catch (e) {
			console.warn("[TreePad] Post-install migration error:", e);
		}
	}
});
function J(e) {
	return e.token ? `token:${e.token.slice(-12)}` : e.useCookieAuth ? "cookie" : "none";
}
function Y(e, t) {
	q.set(J(e), {
		info: t,
		fetchedAt: Date.now()
	});
}
function Pe(e) {
	return q.get(J(e))?.info ?? null;
}
function X(e) {
	let t = q.get(J(e));
	return t ? Date.now() - t.fetchedAt < Ne ? !0 : t.info.remaining === 0 && !!t.info.resetAt && t.info.resetAt > Date.now() : !1;
}
async function Fe(e) {
	if (!X(e)) return;
	let t = q.get(J(e));
	if (t && t.info.remaining === 0 && t.info.resetAt && t.info.resetAt > Date.now()) throw Error(u(t.info.authMode, t.info));
}
function Ie(e, t) {
	let n = K.get(e);
	if (n) return n;
	let r = t().finally(() => {
		K.delete(e);
	});
	return K.set(e, r), r;
}
function Z(e) {
	return e instanceof Error && e.message ? e.message : "Unknown error";
}
async function Le(e, t) {
	if (t instanceof n && t.rateLimit) {
		Y(e, t.rateLimit);
		return;
	}
	if (!X(e)) try {
		Y(e, await p(e));
	} catch {}
}
async function Re() {
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
async function Q() {
	let e = await xe();
	return e ? {
		token: e,
		tokenSource: await Se()
	} : await Re() ? { useCookieAuth: !0 } : {};
}
async function ze(e = !1) {
	let t = await Q(), r = await we(), a = !!t.token, o = a ? t.tokenSource ?? "manual" : null, s = Pe(t);
	if (e || !s || !X(t)) try {
		s = await p(t), Y(t, s);
	} catch (e) {
		e instanceof n && e.rateLimit && (s = e.rateLimit, Y(t, e.rateLimit));
	}
	return {
		authMode: i(t),
		tokenSource: o,
		hasToken: a,
		rateLimit: s ?? null,
		oauthClientId: r
	};
}
async function Be(e) {
	let t = e.trim();
	if (!t) {
		await W("", "manual");
		return;
	}
	let n = await ne(t);
	Y({
		token: t,
		tokenSource: "manual"
	}, n), await W(t, "manual");
}
async function Ve(e) {
	let t = e?.trim();
	if (t) return await Te(t), t;
	let n = await we();
	if (n) return n;
	throw Error("GitHub OAuth is not configured for this build yet. Use the token flow, or add a client ID in advanced settings.");
}
async function He(e) {
	try {
		return await e.json();
	} catch {
		return {};
	}
}
async function Ue(e) {
	let t = new URLSearchParams({ client_id: e }), n = await fetch(je, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: t
	}), r = await He(n);
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
async function We(e, t) {
	let n = new URLSearchParams({
		client_id: e,
		device_code: t,
		grant_type: Ae
	}), r = await fetch(Me, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: n
	}), i = await He(r);
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
async function Ge(e) {
	let t = await Ve(e);
	return {
		clientId: t,
		flow: await Ue(t)
	};
}
async function Ke(e, t) {
	let n = await We(await Ve(t), e);
	if (n.status === "success" && n.accessToken) {
		let e = await ne(n.accessToken);
		Y({
			token: n.accessToken,
			tokenSource: "oauth-device"
		}, e), await W(n.accessToken, "oauth-device");
	}
	return n;
}
async function $(e, t) {
	let n = await Q();
	await Fe(n);
	try {
		return await Ie(e, () => t(n));
	} catch (e) {
		throw await Le(n, e), e;
	}
}
async function qe(e) {
	await Ce(e);
}
async function Je(e, t, n) {
	let r = await G();
	if (!r) throw Error("AI API key not configured");
	let i = e.replace(/\/+$/, "") + "/chat/completions", a = await fetch(i, {
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
chrome.runtime.onMessage.addListener((e, t, n) => {
	if (e.type === "FETCH_TREE") return Ze(e.owner, e.repo, e.branch).then(n).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "FETCH_RAW") return Xe(e.owner, e.repo, e.branch, e.path).then((e) => n({ base64: e })).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "FETCH_BRANCHES") return Ye(e.owner, e.repo).then((e) => n({ branch: e })).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "SET_TOKEN") return Be(e.token).then(() => n({ ok: !0 })).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "GET_TOKEN") return Promise.all([xe(), Se()]).then(([e, t]) => n({
		token: e ? "••••" : "",
		source: t ?? null
	})), !0;
	if (e.type === "GET_GITHUB_AUTH_STATUS") return ze(e.force).then((e) => n({ status: e })).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "SET_GITHUB_OAUTH_CLIENT_ID") return Te(e.clientId).then(() => n({ ok: !0 })).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "START_GITHUB_DEVICE_FLOW") return Ge(e.clientId).then((e) => n(e)).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "POLL_GITHUB_DEVICE_FLOW") return Ke(e.deviceCode, e.clientId).then((e) => n(e)).catch((e) => n({ error: Z(e) })), !0;
	if (e.type === "SET_AI_KEY") return qe(e.key).then(() => n({ ok: !0 })), !0;
	if (e.type === "GET_AI_KEY") return G().then((e) => n({ key: e ? "••••" : "" })), !0;
	if (e.type === "AI_CHAT") return Je(e.baseUrl, e.model, e.messages).then((e) => n({ content: e })).catch((e) => n({ error: Z(e) })), !0;
}), chrome.runtime.onConnect.addListener((e) => {
	e.name === "ai-stream" && e.onMessage.addListener(async (t) => {
		if (t.type === "AI_CHAT_STREAM") try {
			let n = await G();
			if (!n) {
				e.postMessage({
					type: "error",
					error: "AI API key not configured"
				});
				return;
			}
			let r = t.baseUrl.replace(/\/+$/, "") + "/chat/completions", i = await fetch(r, {
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
async function Ye(e, t) {
	return await ue(e, t) || $(`branch:${e}/${t}`, async (n) => {
		let r = await ae(e, t, n);
		return await de(e, t, r), r;
	});
}
async function Xe(e, t, n, r) {
	return $(`raw:${e}/${t}:${n}:${r}`, (i) => ie(e, t, n, r, i));
}
async function Ze(e, t, n) {
	let r = await ce(e, t, n);
	return r ? {
		nodes: r,
		truncated: !1
	} : $(`tree:${e}/${t}:${n}`, async (r) => {
		let i = await re(e, t, n, r), a = fe(i.tree);
		return await le(e, t, n, i.sha, a), {
			nodes: a,
			truncated: i.truncated
		};
	});
}
//#endregion
