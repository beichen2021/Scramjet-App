importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// XOR 混淆函数（与前端保持一致，Key 可以自己换，比如 0x5F）
function xor(str, key = 0x5F) {
	return Array.from(str)
		.map(c => String.fromCharCode(c.charCodeAt(0) ^ key))
		.join('');
}

// 代理模式包装 event 对象，只重写 request 属性
function wrapEvent(event, newRequest) {
	return new Proxy(event, {
		get(target, prop) {
			if (prop === 'request') {
				return newRequest;
			}
			if (typeof target[prop] === 'function') {
				return target[prop].bind(target);
			}
			return target[prop];
		}
	});
}

async function handleRequest(event) {
	await scramjet.loadConfig();

	let activeEvent = event;
	const urlObj = new URL(event.request.url);
	const prefix = "/hgws/";

	// 拦截并解密主页面请求 (如果是加密的 Base64 + XOR 形式)
	if (urlObj.pathname.startsWith(prefix)) {
		const encryptedPart = urlObj.pathname.substring(prefix.length);
		// 确保它是一个加密串，而不是已经解密好的普通 URL
		if (encryptedPart && !encryptedPart.includes('/') && !encryptedPart.startsWith('http') && !encryptedPart.startsWith('https')) {
			try {
				// 先解密 Base64，再解密 XOR
				const decryptedPart = xor(atob(decodeURIComponent(encryptedPart)));
				urlObj.pathname = prefix + decryptedPart;

				console.log("[SW Intercept] 🔓 解密成功:", encryptedPart, "->", decryptedPart);

				// 构造全新的 Request 并重写 Event
				const newRequest = new Request(urlObj.toString(), event.request);
				activeEvent = wrapEvent(event, newRequest);
			} catch (e) {
				console.error("[SW Intercept] ❌ 解密失败:", e);
			}
		}
	}

	if (scramjet.route(activeEvent)) {
		return scramjet.fetch(activeEvent);
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
