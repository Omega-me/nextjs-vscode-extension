//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  const vscode = acquireVsCodeApi();

  document.querySelector('.create-page').addEventListener('click', () => {
    createPage();
  });
  document.querySelector('.create-module').addEventListener('click', () => {
    createModule();
  });
  document.querySelector('.create-component').addEventListener('click', () => {
    createComponent();
  });
  document.querySelector('.create-config').addEventListener('click', () => {
    createConfig();
  });

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'createPage':
        createPage();
        break;
      case 'createModule':
        createModule();
        break;
      case 'createComponent':
        createComponent();
        break;
      case 'createConfig':
        createConfig();
        break;
    }
  });

  function createPage() {
    vscode.postMessage({ type: 'createPage', value: '' });
  }
  function createModule() {
    vscode.postMessage({ type: 'createModule', value: '' });
  }
  function createComponent() {
    vscode.postMessage({ type: 'createComponent', value: '' });
  }
  function createConfig() {
    vscode.postMessage({ type: 'createConfig', value: '' });
  }
})();
