/* Singular runs entirely inside this disposable browser worker. */
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
  self.Module = {
    arguments: ['-q', '--no-rc', '--no-tty', '/workspace/abv.sing'],
    noInitialRun: false,
    noExitRuntime: false,
    locateFile: path => new URL(path, self.location.href).href,
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
    importScripts('Singular.js');
  } catch (error) {
    finish(1, String(error));
  }
};
