/**
 * 部落冲突国际服（Clash of Clans）网络状况诊断脚本
 * 功能：检测 Supercell ID 验证服务器与游戏核心 API 的响应延迟，并发出通知提醒
 * 环境：Loon JavaScript 运行环境
 */

const $ = new Env("部落冲突网络检测");

(async () => {
    const startTime = Date.now();
    const testTargets = [
        { name: "Supercell ID 认证服务", url: "https://id.supercell.com" },
        { name: "部落冲突游戏 API", url: "https://game.clashofclans.com" },
        { name: "Supercell 官方 CDN", url: "https://cdn.supercell.com" }
    ];

    let results = [];
    let hasError = false;

    for (const target of testTargets) {
        const start = Date.now();
        try {
            const response = await httpGet(target.url);
            const duration = Date.now() - start;
            let statusText = "🟢 优异";
            if (duration > 300) statusText = "🟡 一般";
            if (duration > 800) statusText = "🔴 较慢";
            results.push(`${target.name}: ${duration}ms (${statusText})`);
        } catch (err) {
            hasError = true;
            results.push(`${target.name}: ❌ 连接失败/超时`);
        }
    }

    const totalTime = Date.now() - startTime;
    const title = "🏰 部落冲突国际服网络诊断";
    const subtitle = hasError ? "⚠️ 存在连接异常，请检查节点或UDP设置" : "✅ 网络连接极佳，适合进行部落战";
    const body = results.join("\n") + `\n⏱️ 总耗时: ${totalTime}ms`;

    $.notification.post(title, subtitle, body);
    $done();
})();

function httpGet(url) {
    return new Promise((resolve, reject) => {
        $httpClient.get({ url: url, timeout: 5000 }, (error, response, data) => {
            if (error) {
                reject(error);
            } else {
                resolve({ response, data });
            }
        });
    });
}

// 简易 Loon 环境封装
function Env(name) {
    return {
        name,
        notification: {
            post: (title, subtitle, body) => {
                if (typeof $notification !== "undefined") {
                    $notification.post(title, subtitle, body);
                } else {
                    console.log(`[${title}] ${subtitle}\n${body}`);
                }
            }
        }
    };
}
