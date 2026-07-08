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

// XOR 混淆函数（加密和解密使用同一个函数，Key 与 sw.js 保持一致）
function xor(str, key = 0x5F) {
	return Array.from(str)
		.map(c => String.fromCharCode(c.charCodeAt(0) ^ key))
		.join('');
}

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	// 绑定自定义路由前缀
	prefix: "/hgws/", 
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
	// 这里默认使用您已跑通的自定义优选域名（如果需要临时切换回 Render，可以直接换成 wisp-028b.onrender.com）
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

// 核心优化：页面加载时立即在后台注册 SW 和初始化 Wisp 隧道，消除异步竞争
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

	const rawUrl = search(address.value, searchEngine.value);
	console.log("[SJ] 原始导航目标 ->", rawUrl);

	// 1. 先进行 XOR 混淆，再进行 Base64 编码，实现网址混淆加密
	const encryptedUrl = btoa(xor(rawUrl)); 
	console.log("[SJ] 🔒 加密后的目标 ->", encryptedUrl);

	// 双重保险：以防万一用户点得太快，后台 Transport 还没就绪
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
	
	// 2. 这里直接传加密后的乱码，不配置默认的 codec，让它由 sw.js 顶层拦截解密
	frame.go(encryptedUrl); 
});
