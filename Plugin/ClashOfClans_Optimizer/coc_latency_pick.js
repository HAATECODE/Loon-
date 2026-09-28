/**
 * 部落冲突：开游戏前在指定 select 策略组内做一次时延优选，会话内不再切换节点
 * 触发：http-request 匹配 Supercell 认证/游戏相关域名
 * 依赖：Loon Script API（$config / $httpClient / $persistentStore）
 */

const STORE_KEY = "coc_latency_pick_state_v1";

const args = typeof $argument === "object" && $argument ? $argument : {};
const policyGroup = String(args.cocPolicyGroup || "CoC专用").trim();
const idleMinutes = Math.max(5, parseInt(args.idleMinutes || "45", 10) || 45);
const testUrl = String(args.testUrl || "https://id.supercell.com").trim();
const enablePick = String(args.enableLatencyPick ?? "true") !== "false";
const perNodeTimeout = Math.min(
  8000,
  Math.max(2000, parseInt(args.perNodeTimeout || "4000", 10) || 4000)
);
const notifyOnPick = String(args.notifyOnPick ?? "true") !== "false";

function readState() {
  try {
    const raw = $persistentStore.read(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeState(state) {
  $persistentStore.write(JSON.stringify(state), STORE_KEY);
}

function isSkippablePolicy(name) {
  if (!name) return true;
  const u = String(name).toUpperCase();
  return u === "DIRECT" || u === "REJECT";
}

function pingNode(node) {
  return new Promise((resolve) => {
    const start = Date.now();
    $httpClient.get(
      {
        url: testUrl,
        node,
        timeout: perNodeTimeout,
        "auto-redirect": true,
      },
      (err) => {
        resolve({
          node,
          ok: !err,
          ms: err ? 999999 : Date.now() - start,
        });
      }
    );
  });
}

function getSubPolicies(name) {
  return new Promise((resolve) => {
    $config.getSubPolicies(name, (text) => {
      try {
        resolve(text ? JSON.parse(text) : []);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

function shouldRepick(state, now) {
  if (!state.lockedNode) return true;
  const last = state.lastActivity || 0;
  return now - last >= idleMinutes * 60 * 1000;
}

function finishWithNode(node) {
  if (node) {
    $done({ node });
  } else {
    $done({});
  }
}

(async () => {
  if (!enablePick) {
    $done({});
    return;
  }

  const now = Date.now();
  let state = readState();

  if (!shouldRepick(state, now)) {
    state.lastActivity = now;
    writeState(state);
    finishWithNode(state.lockedNode);
    return;
  }

  const candidates = (await getSubPolicies(policyGroup)).filter(
    (n) => !isSkippablePolicy(n)
  );

  if (!candidates.length) {
    $notification.post(
      "CoC 节点优选",
      "未找到可测速的子策略",
      `请确认策略组「${policyGroup}」为 select 且子项为节点名称`
    );
    $done({});
    return;
  }

  const results = await Promise.all(candidates.map(pingNode));
  const okList = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  const best = okList[0];

  if (!best) {
    $notification.post(
      "CoC 节点优选",
      "全部节点探测失败",
      `策略组：${policyGroup}\nURL：${testUrl}`
    );
    if (state.lockedNode) {
      state.lastActivity = now;
      writeState(state);
      finishWithNode(state.lockedNode);
    } else {
      $done({});
    }
    return;
  }

  const prev = state.lockedNode;
  const changed = $config.setSelectPolicy(policyGroup, best.node);

  state = {
    lockedNode: best.node,
    lockedAt: now,
    lastActivity: now,
    lastMs: best.ms,
    policyGroup,
  };
  writeState(state);

  if (notifyOnPick && best.node !== prev) {
    $notification.post(
      "CoC 节点优选",
      changed ? `已锁定：${best.node}` : `建议节点：${best.node}`,
      `约 ${best.ms} ms\n组内 ${idleMinutes} 分钟内有流量将不再切换\n策略组：${policyGroup}`
    );
  }

  finishWithNode(best.node);
})();
