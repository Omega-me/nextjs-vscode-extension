import vscode from 'vscode';
import { IData, capitalize, generateComponent, generateModule, generatePage, generateUtil, getPageName } from './utils';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('nextcodegen.generate', async () => {
    if (vscode.workspace.workspaceFolders !== undefined) {
      let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
      if (f) {
        try {
          let config: any;
          const fileUri = vscode.Uri.file(`${f}/gen.json`);
          try {
            await vscode.workspace.fs.stat(fileUri);
            const contentBuffer = await vscode.workspace.fs.readFile(fileUri);
            const contentText = Buffer.from(contentBuffer).toString('utf-8');
            config = JSON.parse(contentText);
          } catch (error) {
            config = {
              pagesPath: '',
              modulesPath: '',
              componentsPath: '',
            };
          }

          let pascalPage: string;
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
            const moduleChecker = await vscode.window.showInputBox({
              prompt: 'Does page has a module and react query support?',
              value: 'Yes',
            });
            data.hasModule = moduleChecker === 'Yes' ? true : false;
            if (data.hasModule) {
              data.moduleName = `${pascalPage}Module`;
              data.componentName = pascalPage;
            }
            vscode.window.showInformationMessage(`Hello, ${JSON.stringify(data)}`);
          } else {
            vscode.window.showInformationMessage('You canceled the input.');
          }

          const paths: { pagePath?: string; modulePath?: string; moduleFolderPath?: string; componentsFolderPath?: string; componentPath?: string } = {};
          if (data.page) {
            if (vscode.workspace.workspaceFolders !== undefined) {
              let f = vscode.workspace.workspaceFolders[0].uri.fsPath;

              // Create page and util files
              paths.pagePath =
                config.pagesPath && config.pagesPath !== undefined && config.pagesPath.trim() !== ''
                  ? `${f}${config.pagesPath}\\${data.pagePath?.toLowerCase()}`
                  : `${f}\\src\\app\\${data.pagePath?.toLowerCase()}`;
              const pageUri = vscode.Uri.file(paths.pagePath);
              await createFile(pageUri, 'page.tsx', generatePage(data));
              await createFile(pageUri, 'utils.ts', generateUtil(data));

              if (data.hasModule) {
                // Create module and component files
                paths.modulePath =
                  config.modulesPath && config.modulesPath !== undefined && config.modulesPath.trim() !== ''
                    ? `${f}${config.modulesPath}\\${data.page}`
                    : `${f}\\src\\containers\\modules\\${data.page}`;
                paths.componentPath =
                  config.componentsPath && config.componentsPath !== undefined && config.componentsPath.trim() !== ''
                    ? `${f}${config.componentsPath}\\${data.page}`
                    : `${f}\\src\\containers\\components\\${data.page}`;
                const moduleUri = vscode.Uri.file(paths.modulePath);
                const componentUri = vscode.Uri.file(paths.componentPath);

                await createFile(moduleUri, `${data.moduleName}.tsx`, generateModule(data));
                await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data));

                // export module and component file
                paths.moduleFolderPath = config.modulesPath ? `${f}${config.modulesPath}` : `${f}\\src\\containers\\modules`;
                paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
                const moduleFolderUri = vscode.Uri.file(paths.moduleFolderPath);
                const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
                await exportContainers(moduleFolderUri, `export { default as ${data.moduleName} } from './${data.page}/${data.moduleName}';`);
                await exportContainers(componentForlderUri, `export { default as ${data.componentName} } from './${data.page}/${data.componentName}';`);
              }

              vscode.window.showInformationMessage(f);
            } else {
              vscode.window.showErrorMessage('Next code generator: Working folder not found, open a folder an try again');
            }
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Error opening file: ${error.message}`);
        }
      }
    }
  });
  context.subscriptions.push(disposable);
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
