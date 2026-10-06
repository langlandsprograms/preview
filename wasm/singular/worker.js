/* Each CLI batch has fresh state; assets and compiled code come from the
 * page's shared cache. This worker makes no engine-asset network requests.
 */
let started = false;
self.onmessage = ({data}) => {
  if (started || data.type !== 'run') return;
  started = true;
  let finished = false;
  const finish = (code, error) => {
    if (finished) return;
    finished = true;
    self.postMessage({type: 'done', code, error});
    self.close();
  };
  if (!data.assets || !(data.assets.module instanceof WebAssembly.Module)
    || !(data.assets.libraryData instanceof ArrayBuffer) || typeof data.assets.runtimeUrl !== 'string') {
    finish(1, 'Missing cached Singular engine assets.');
    return;
  }
  self.Module = {
    arguments: ['-q', '--no-rc', '--no-tty', '/workspace/abv.sing'],
    noInitialRun: false,
    noExitRuntime: false,
    locateFile: path => new URL(path, self.location.href).href,
    getPreloadedPackage: () => data.assets.libraryData,
    instantiateWasm: (imports, receiveInstance) => {
      try {
        const instance = new WebAssembly.Instance(data.assets.module, imports);
        receiveInstance(instance, data.assets.module);
        return instance.exports;
      } catch (error) {
        finish(1, String(error));
        return {};
      }
    },
    print: text => self.postMessage({type: 'stdout', text: String(text)}),
    printErr: text => self.postMessage({type: 'stderr', text: String(text)}),
    preRun: [() => {
      const fs = self.Module.FS || self.FS;
      fs.mkdir('/workspace');
      fs.writeFile('/workspace/abv.sing', new TextEncoder().encode(data.script));
    }],
    onRuntimeInitialized: () => self.postMessage({type: 'ready'}),
    onAbort: reason => finish(1, String(reason)),
    onExit: code => finish(code),
  };
  try {
    importScripts(data.assets.runtimeUrl);
  } catch (error) {
    finish(1, String(error));
  }
};
