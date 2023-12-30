import vscode, { Uri } from 'vscode';
import {
  IConfig,
  IData,
  capitalize,
  checkIfEmptyString,
  checkValidConfigPath,
  generateComponent,
  generateCssFile,
  generateModule,
  generateModuleWithoutComponent,
  generatePage,
  generateProviderFile,
  generateUtil,
  getPageName,
} from './utils';

export function activate(context: vscode.ExtensionContext) {
  getPackageJson().then(val => {
    if (val) {
      // create webview
      const provider = new ViewProvider(context.extensionUri);
      context.subscriptions.push(vscode.window.registerWebviewViewProvider(ViewProvider.viewType, provider));

      const generateWelcomeDisposable = vscode.commands.registerCommand('nextcodegen.welcome', async () => {});
      context.subscriptions.push(generateWelcomeDisposable);

      // generate page, page util, module and component
      const generatePageDisposable = vscode.commands.registerCommand('nextcodegen.generate', async () => {
        const config = await getConfig();

        if (config) {
          let pascalPage: string = '';
          const data: IData = {
            hasParams: false,
            hasMultipleParams: false,
          };
          data.pagePath = await vscode.window.showInputBox({
            prompt: 'Enter page path',
            placeHolder: 'pagepath',
          });
          if (data.pagePath) {
            data.page = getPageName(data.pagePath);
            data.pageOriginalName = data.page;
            data.page = data.page?.toLowerCase();
            data.pageFolder = data.page;
          }

          if (data.page && data.pageOriginalName) {
            const pageParams = data.page.split('');
            if (pageParams[0] === '[' && pageParams[pageParams.length - 1] === ']') {
              data.hasParams = true;
              if (data.hasParams) {
                if (data.page.includes('...')) {
                  data.hasMultipleParams = true;
                } else {
                  data.hasMultipleParams = false;
                }
              }
              const rgex: RegExp = /[\[\]]|\.\.\./g;
              data.page = data.page.replace(rgex, '');
              data.pageOriginalName = data.pageOriginalName.replace(rgex, '');
            } else {
              data.hasParams = false;
              data.hasMultipleParams = false;
            }
            pascalPage = capitalize(data.pageOriginalName);
            data.pageName = pascalPage + 'Page';
            const withModule = await vscode.window.showInputBox({
              prompt: 'Does page has a module and react query support?',
              value: 'Yes',
            });
            data.hasModule = withModule?.toUpperCase().trim() === 'YES' ? true : false;
            if (data.hasModule) {
              const withContext = await vscode.window.showInputBox({
                prompt: 'Do you want to use react context api for injecting props to the child components?',
                value: 'No',
              });
              data.hasContext = withContext?.toUpperCase().trim() === 'NO' ? false : true;
              data.moduleName = `${pascalPage}Module`;
              data.moduleFile = `${pascalPage}.module`;
              data.componentName = pascalPage;
            }
          } else {
            vscode.window.showInformationMessage('You canceled the input.');
          }

          const paths: {
            pagePath?: string;
            modulePath?: string;
            moduleFolderPath?: string;
            componentsFolderPath?: string;
            componentPath?: string;
            contextPath?: string;
            contextFolderPath?: string;
          } = {};
          if (data.page) {
            if (vscode.workspace.workspaceFolders !== undefined) {
              let f = vscode.workspace.workspaceFolders[0].uri.fsPath;

              // Create page and util files
              paths.pagePath = !checkIfEmptyString(config.pagesPath)
                ? `${f}${config.pagesPath}\\${data.pagePath?.toLowerCase()}`
                : `${f}\\src\\app\\${data.pagePath?.toLowerCase()}`;
              const pageUri = vscode.Uri.file(paths.pagePath);
              await createFile(pageUri, 'page.tsx', generatePage(data, config));
              await createFile(pageUri, `${data.pageName}.utils.ts`, generateUtil(data));

              if (data.hasModule) {
                // Create module and component files4
                paths.modulePath = !checkIfEmptyString(config.modulesPath)
                  ? `${f}${config.modulesPath}\\${data.page}`
                  : `${f}\\src\\containers\\modules\\${data.page}`;
                paths.componentPath = !checkIfEmptyString(config.componentsPath)
                  ? `${f}${config.componentsPath}\\${data.page}`
                  : `${f}\\src\\containers\\components\\${data.page}`;
                const moduleUri = vscode.Uri.file(paths.modulePath);
                const componentUri = vscode.Uri.file(paths.componentPath);

                await createFile(moduleUri, `${data.moduleFile}.tsx`, generateModule(data, config));
                await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data, config));
                await createFile(componentUri, `${data.componentName?.toLowerCase()}.module.scss`, generateCssFile(data));

                let contextxUri: Uri | undefined;
                if (data.hasContext) {
                  paths.contextPath = `${f}\\src\\common\\providers`;
                  contextxUri = vscode.Uri.file(paths.contextPath);
                  if (contextxUri) {
                    await createFile(contextxUri, `${data.moduleName}.provider.tsx`, generateProviderFile(data));
                  }
                }

                // export module and component file
                paths.moduleFolderPath = config.modulesPath ? `${f}${config.modulesPath}` : `${f}\\src\\containers\\modules`;
                paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
                const moduleFolderUri = vscode.Uri.file(paths.moduleFolderPath);
                const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
                await exportContainers(moduleFolderUri, `export { default as ${data.moduleName} } from './${data.page}/${data.moduleFile}';`);
                await exportContainers(componentForlderUri, `export { default as ${data.componentName} } from './${data.page}/${data.componentName}';`);

                if (data.hasContext) {
                  paths.contextFolderPath = `${f}\\src\\common\\providers`;
                  const contextForlderUri = vscode.Uri.file(paths.contextFolderPath);
                  await exportContainers(contextForlderUri, `export * from './${data.moduleName}.provider';`);
                }
              }
            } else {
              vscode.window.showErrorMessage('Next code generator: Working folder not found, open a folder an try again');
            }
          }
        }
      });
      context.subscriptions.push(generatePageDisposable);

      // generate module and component
      const generateNextModuleDisposable = vscode.commands.registerCommand('nextcodegen.generate_module', async () => {
        const config = await getConfig();
        const data: { module?: string; moduleName?: string; moduleFile?: string; hasComponent?: boolean; componentName?: string; hasContext?: boolean } = {};

        if (config) {
          const moduleInfo = await vscode.window.showInputBox({
            prompt: 'Enter module name',
            placeHolder: 'modulename',
          });

          if (moduleInfo) {
            const capitalisedModule = capitalize(moduleInfo);
            data.moduleName = capitalisedModule + 'Module';
            data.moduleFile = capitalisedModule + '.module';
            data.module = moduleInfo.toLowerCase();

            const withContext = await vscode.window.showInputBox({
              prompt: 'Do you want to use react context api for injecting props to the child components?',
              value: 'No',
            });
            data.hasContext = withContext?.toUpperCase().trim() === 'NO' ? false : true;

            const withComponent = await vscode.window.showInputBox({
              prompt: 'Do you want to generate a component?',
              value: 'Yes',
            });
            data.hasComponent = withComponent?.toUpperCase().trim() === 'YES' ? true : false;
            if (data.hasComponent) {
              data.componentName = capitalisedModule;
            }

            const paths: {
              modulePath?: string;
              moduleFolderPath?: string;
              componentsFolderPath?: string;
              componentPath?: string;
              contextPath?: string;
              contextFolderPath?: string;
            } = {};
            if (vscode.workspace.workspaceFolders !== undefined) {
              let f = vscode.workspace.workspaceFolders[0].uri.fsPath;

              paths.modulePath = !checkIfEmptyString(config.modulesPath)
                ? `${f}${config.modulesPath}\\${data.module}`
                : `${f}\\src\\containers\\modules\\${data.module}`;
              const moduleUri = vscode.Uri.file(paths.modulePath);

              if (data.hasComponent) {
                await createFile(moduleUri, `${data.moduleFile}.tsx`, generateModule(data, config));
              } else {
                await createFile(moduleUri, `${data.moduleFile}.tsx`, generateModuleWithoutComponent(data));
              }
              paths.moduleFolderPath = config.modulesPath ? `${f}${config.modulesPath}` : `${f}\\src\\containers\\modules`;
              const moduleFolderUri = vscode.Uri.file(paths.moduleFolderPath);

              await exportContainers(moduleFolderUri, `export { default as ${data.moduleName} } from './${data.module}/${data.moduleFile}';`);

              if (data.hasContext) {
                paths.contextPath = `${f}\\src\\common\\providers`;
                const conxtextUri = vscode.Uri.file(paths.contextPath);

                await createFile(conxtextUri, `${data.moduleName}.provider.tsx`, generateProviderFile(data));
                paths.contextFolderPath = `${f}\\src\\common\\providers`;
                const contextFolderUri = vscode.Uri.file(paths.contextFolderPath);
                await exportContainers(contextFolderUri, `export *  from './${data.moduleName}.provider';`);
              }

              if (data.hasComponent) {
                paths.componentPath = !checkIfEmptyString(config.componentsPath)
                  ? `${f}${config.componentsPath}\\${data.module}`
                  : `${f}\\src\\containers\\components\\${data.module}`;
                const componentUri = vscode.Uri.file(paths.componentPath);

                await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data, config));
                await createFile(componentUri, `${data.componentName?.toLowerCase()}.module.scss`, generateCssFile(data));
                paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
                const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
                await exportContainers(componentForlderUri, `export { default as ${data.componentName} } from './${data.module}/${data.componentName}';`);
              }
            } else {
              vscode.window.showErrorMessage('Next code generator: Working folder not found, open a folder an try again');
            }
          } else {
            vscode.window.showInformationMessage('You canceled the input.');
          }
        }
      });
      context.subscriptions.push(generateNextModuleDisposable);

      // generate component
      const generateNextComponentDisposable = vscode.commands.registerCommand('nextcodegen.generate_component', async context => {
        const config = await getConfig();
        const data: { componentName?: string; componentFolder?: string; hasContext?: boolean } = {};
        if (config) {
          const componentInfo = await vscode.window.showInputBox({
            prompt: 'Enter component name',
            placeHolder: 'componentname',
          });

          if (componentInfo) {
            data.componentName = capitalize(componentInfo);
            data.componentFolder = componentInfo.toLowerCase();

            const withContext = await vscode.window.showInputBox({
              prompt: 'Do you want to use react context api import from module?',
              value: 'No',
            });
            data.hasContext = withContext?.toUpperCase().trim() === 'NO' ? false : true;

            const paths: { componentsFolderPath?: string; componentPath?: string } = {};
            if (vscode.workspace.workspaceFolders !== undefined) {
              let f = vscode.workspace.workspaceFolders[0].uri.fsPath;

              paths.componentPath = !checkIfEmptyString(config.componentsPath)
                ? `${f}${config.componentsPath}\\${data.componentFolder}`
                : `${f}\\src\\containers\\components\\${data.componentFolder}`;
              const componentUri = vscode.Uri.file(paths.componentPath);

              await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data, config));
              await createFile(componentUri, `${data.componentName?.toLowerCase()}.module.scss`, generateCssFile(data));
              paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
              const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
              await exportContainers(
                componentForlderUri,
                `export { default as ${data.componentName} } from './${data.componentFolder}/${data.componentName}';`,
              );
            } else {
              vscode.window.showErrorMessage('Next code generator: Working folder not found, open a folder an try again');
            }
          } else {
            vscode.window.showInformationMessage('You canceled the input.');
          }
        }
      });
      context.subscriptions.push(generateNextComponentDisposable);

      // generate config file
      const generateConfigDisposable = vscode.commands.registerCommand('nextcodegen.generate_config', async () => {
        if (vscode.workspace.workspaceFolders !== undefined) {
          let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
          let pathUri = vscode.workspace.workspaceFolders[0].uri;
          if (f) {
            try {
              let newConfig: IConfig = {
                pagesPath: '',
                modulesPath: '',
                componentsPath: '',
              };
              const configUri = getFileUri('/gen.json');
              if (configUri) {
                try {
                  await vscode.workspace.fs.stat(configUri);
                  const answer1 = await vscode.window.showInputBox({
                    prompt: 'Config file exists, do you want to recreate it?',
                    value: 'Yes',
                  });
                  if (answer1?.toUpperCase().trim() === 'YES') {
                    const answer2 = await vscode.window.showInputBox({
                      prompt: 'Your older config file will be erased, do you want to proceed?',
                      value: 'Yes',
                    });
                    if (answer2?.toUpperCase().trim() === 'YES') {
                      await createFile(pathUri, 'gen.json', JSON.stringify(newConfig));
                    }
                  }
                } catch (error) {
                  await createFile(pathUri, 'gen.json', JSON.stringify(newConfig));
                }
              }
            } catch (error: any) {
              vscode.window.showErrorMessage(`Error opening file: ${error.message}`);
            }
          }
        }
      });
      context.subscriptions.push(generateConfigDisposable);
    }
  });
}

const createFile = async (uri: vscode.Uri, pageName: string, content: string) => {
  const fileUri = vscode.Uri.joinPath(uri, pageName);
  const contentBuffer = Buffer.from(content, 'utf-8');
  await vscode.workspace.fs.writeFile(fileUri, contentBuffer);
};

const exportContainers = async (uri: vscode.Uri, content: string) => {
  const fileUri = vscode.Uri.joinPath(uri, 'index.ts');
  try {
    await vscode.workspace.fs.stat(fileUri);
  } catch (error) {
    await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
  }
  const existingContentBuffer = await vscode.workspace.fs.readFile(fileUri);
  const existingContent = Buffer.from(existingContentBuffer).toString('utf-8');
  let fileContent: string;
  if (existingContent.trim() === '') {
    fileContent = content;
  } else {
    fileContent = existingContent + '\n' + content;
  }
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(fileContent, 'utf-8'));
};

const readFileContent = async (fileUri: vscode.Uri) => {
  await vscode.workspace.fs.stat(fileUri);
  const contentBuffer = await vscode.workspace.fs.readFile(fileUri);
  const contentText = Buffer.from(contentBuffer).toString('utf-8');
  return contentText;
};

const getFileUri = (filePath: string) => {
  if (vscode.workspace.workspaceFolders !== undefined) {
    let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (f) {
      try {
        return vscode.Uri.file(`${f}${filePath}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error opening file: ${error.message}`);
      }
    }
  }
};

const getConfig = async () => {
  let config: IConfig = {};
  try {
    const fileUri = getFileUri('/gen.json');
    if (fileUri) {
      config = JSON.parse(await readFileContent(fileUri));
    }
  } catch (error) {
    config = {
      pagesPath: '',
      modulesPath: '',
      componentsPath: '',
    };
  }

  const validPath = checkValidConfigPath(config);

  if (!validPath) {
    vscode.window.showErrorMessage('Invalid paths specified in gen.json file. Path should start from /src directory');
    return;
  }
  return config;
};

const getPackageJson = async () => {
  try {
    const fileUri = getFileUri('/package.json');
    if (fileUri) {
      const packageJson = JSON.parse(await readFileContent(fileUri));
      if (packageJson.activate_nextjs_extension) {
        return true;
      } else {
        vscode.window.showErrorMessage(
          'To use next js extension you need to activate on package.json file, to activate it add ("activate_nextjs_extension": true) on package.json file ',
        );
        return false;
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage('No package.json file exists');
    return false;
  }
};
class ViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'nextcodegen.gen_view';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'createPage':
          vscode.commands.executeCommand('nextcodegen.generate');
          break;
        case 'createModule':
          vscode.commands.executeCommand('nextcodegen.generate_module');
          break;
        case 'createComponent':
          vscode.commands.executeCommand('nextcodegen.generate_component');
          break;
        case 'createConfig':
          vscode.commands.executeCommand('nextcodegen.generate_config');
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
          <p><b>Generate next js code and snippets</b></p>

          <button class="create-page">Generate next js page</button>
          <br/>
          <button class="create-module">Generate next js module</button>
          <br/>
          <button class="create-component">Generate next js component</button>
          <br/>
          <button class="create-config">Generate config file</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
