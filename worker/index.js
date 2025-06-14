// worker/index.js
import wasmInit from './dist/hello_wasm.js'; // wasm-pack で生成された JS

let wasm;

export default {
  async fetch(request, env, ctx) {
    if (!wasm) {
      wasm = await wasmInit(); // 初回のみ wasm 初期化
    }

    const url = new URL(request.url);
    if (url.pathname === '/hello') {
      const message = wasm.greet("Cloudflare"); // Rust 側の関数呼び出し
      return new Response(message);
    }

    return new Response("Not found", { status: 404 });
  }
}
