/**
 * 部落冲突网络诊断（仅通知，不切换策略）
 */

const $ = new Env("部落冲突网络检测");

(async () => {
  const startTime = Date.now();
  const testTargets = [
    { name: "Supercell ID", url: "https://id.supercell.com" },
    { name: "CoC 开发者 API", url: "https://developer.clashofclans.com" },
    { name: "游戏资源", url: "https://game-assets.clashofclans.com" },
    { name: "Supercell CDN", url: "https://cdn.supercell.com" },
  ];

  let results = [];
  let hasError = false;

  for (const target of testTargets) {
    const start = Date.now();
    try {
      await httpGet(target.url);
      const duration = Date.now() - start;
      let statusText = "优异";
      if (duration > 300) statusText = "一般";
      if (duration > 800) statusText = "较慢";
      results.push(`${target.name}: ${duration}ms (${statusText})`);
    } catch (err) {
      hasError = true;
      results.push(`${target.name}: 连接失败/超时`);
    }
  }

  const totalTime = Date.now() - startTime;
  const title = "部落冲突国际服网络诊断";
  const subtitle = hasError
    ? "存在连接异常，请检查节点或 UDP"
    : "连接正常（本脚本不会切换节点）";
  const body = results.join("\n") + `\n总耗时: ${totalTime}ms`;

  $.notification.post(title, subtitle, body);
  $done();
})();

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, timeout: 5000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function Env() {
  return {
    notification: {
      post: (title, subtitle, body) => {
        if (typeof $notification !== "undefined") {
          $notification.post(title, subtitle, body);
        }
      },
    },
  };
}
