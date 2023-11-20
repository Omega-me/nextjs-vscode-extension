import vscode from 'vscode';
import { IConfig, IData, capitalize, checkIfEmptyString, generateComponent, generateModule, generatePage, generateUtil, getPageName } from './utils';

export function activate(context: vscode.ExtensionContext) {
  let config: IConfig = {};
  const generatePageDisposable = vscode.commands.registerCommand('nextcodegen.generate', async () => {
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
    } else {
      vscode.window.showInformationMessage('You canceled the input.');
    }

    const paths: { pagePath?: string; modulePath?: string; moduleFolderPath?: string; componentsFolderPath?: string; componentPath?: string } = {};
    if (data.page) {
      if (vscode.workspace.workspaceFolders !== undefined) {
        let f = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // Create page and util files
        paths.pagePath = !checkIfEmptyString(config.pagesPath)
          ? `${f}${config.pagesPath}\\${data.pagePath?.toLowerCase()}`
          : `${f}\\src\\app\\${data.pagePath?.toLowerCase()}`;
        const pageUri = vscode.Uri.file(paths.pagePath);
        await createFile(pageUri, 'page.tsx', generatePage(data, config));
        await createFile(pageUri, 'utils.ts', generateUtil(data));

        if (data.hasModule) {
          // Create module and component files
          paths.modulePath = !checkIfEmptyString(config.modulesPath)
            ? `${f}${config.modulesPath}\\${data.page}`
            : `${f}\\src\\containers\\modules\\${data.page}`;
          paths.componentPath = !checkIfEmptyString(config.componentsPath)
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
  });
  context.subscriptions.push(generatePageDisposable);

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
              if (answer1 === 'Yes') {
                const answer2 = await vscode.window.showInputBox({
                  prompt: 'Your older config file will be erased, do you want to proceed?',
                  value: 'Yes',
                });
                if (answer2 === 'Yes') {
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
