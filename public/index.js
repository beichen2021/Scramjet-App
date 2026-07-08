"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// 抽离出单独的初始化函数，用于建立 Wisp 代理通道
async function initTransport() {
	let wispUrl = "wss://ws.opentech.dpdns.org/wisp/"; 
	console.log("[BareMux] 🛸 正在后台建立 Wisp 隧道 ->", wispUrl);
	try {
		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);
		console.log("[BareMux] ✅ Wisp 隧道与 libcurl 已经准备就绪！");
	} catch (err) {
		console.error("[BareMux] ❌ 建立 Wisp 隧道失败:", err);
	}
}

// 核心优化：页面加载时立即在后台注册 SW 和初始化 Wisp 隧道
(async () => {
	try {
		await registerSW();
		console.log("[SW] 🟢 Service Worker 注册并激活成功");
	} catch (err) {
		console.error("[SW] 🔴 Service Worker 注册失败:", err);
	}
	await initTransport();
})();

form.addEventListener("submit", async (event) => {
	event.preventDefault();

	const url = search(address.value, searchEngine.value);
	console.log("[SJ] 🚀 用户发起导航 ->", url);

	// 双重保险：以防万一 Transport 还没初始化完
	try {
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await initTransport();
		}
	} catch (e) {
		console.warn("[SJ] 检查 Transport 状态异常:", e);
	}

	const frame = scramjet.createFrame();
	frame.frame.id = "sj-frame";
	document.body.appendChild(frame.frame);
	frame.go(url);
});
