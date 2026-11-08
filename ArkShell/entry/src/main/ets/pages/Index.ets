import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';

class NativeBridge {
  private sequence: number = 0;

  getBootstrapJson(): string {
    // 仅为测试数据，不连接业务服务。
    return '{"appInfo":{"version":"probe-1","os":"unknown"},"runtimeConfig":{"ok":true,"config":{"appUrl":"https://example.invalid"}},"systemLocale":"zh-CN","windowContext":{"kind":"main"}}';
  }

  echo(value: string): string {
    return '原生回声:' + value;
  }

  add(left: number, right: number): number {
    return left + right;
  }

  isReady(): boolean {
    return true;
  }

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }
}

// 单段注入脚本避免多段脚本排序带来的歧义。
const BOOTSTRAP_SCRIPT: string = `
(function () {
  'use strict';
  // 通配匹配仅用于兼容 rawfile 注入；脚本本身限制在本地验证页执行。
  if (location.href !== 'resource://rawfile/probe.html') return;
  window.__bridgeProbe = {
    order: ['shim'],
    readyState: document.readyState,
    proxyAtInjection: typeof window.nativeBridge !== 'undefined'
  };
  try {
    var bootstrap = JSON.parse(window.nativeBridge.getBootstrapJson());
    Object.defineProperty(window, 'desktopAPI', {
      value: Object.freeze(bootstrap),
      writable: false,
      configurable: false
    });
  } catch (error) {
    window.__bridgeProbe.error = String(error);
  }
})();
`;

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge: NativeBridge = new NativeBridge();
  @State status: string = '正在加载本地 Web 验证页';

  build() {
    Column() {
      Text(this.status)
        .id('ArkWebProbeStatus')
        .fontSize(18)
        .padding(12)
        .width('100%')
      Web({ src: $rawfile('probe.html'), controller: this.controller })
        .id('ArkWebProbe')
        .javaScriptAccess(true)
        .javaScriptProxy({
          object: this.bridge,
          name: 'nativeBridge',
          methodList: ['getBootstrapJson', 'echo', 'add', 'isReady', 'nextSequence'],
          controller: this.controller
        })
        .javaScriptOnDocumentStart([{
          script: BOOTSTRAP_SCRIPT,
          // 当前仅加载本地测试页；用通配规则核实 rawfile 的注入行为。
          scriptRules: ['*']
        }])
        .onConsole((event) => {
          const message: string = event.message.getMessage();
          hilog.info(0x0000, 'ArkShellProbe', '%{public}s', message);
          if (message.startsWith('ARKSHELL_PROBE_RESULT ')) {
            this.status = message.includes('"pass":false') ? '验证失败：请查看页面明细' : '验证通过：9/9';
          }
          return true;
        })
        .onPageEnd((event) => {
          hilog.info(0x0000, 'ArkShellProbe', 'PAGE_END %{public}s', event.url);
        })
        .onErrorReceive((event) => {
          hilog.error(0x0000, 'ArkShellProbe', 'WEB_ERROR %{public}s', event.error.getErrorInfo());
        })
        .onRenderExited(() => {
          this.status = 'Web 渲染进程已退出';
          hilog.error(0x0000, 'ArkShellProbe', 'RENDER_EXITED');
        })
        .layoutWeight(1)
        .width('100%')
    }
    .width('100%')
    .height('100%')
  }
}
