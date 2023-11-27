import vscode from 'vscode';
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
  generateUtil,
  getPageName,
} from './utils';

export function activate(context: vscode.ExtensionContext) {
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
        const moduleChecker = await vscode.window.showInputBox({
          prompt: 'Does page has a module and react query support?',
          value: 'Yes',
        });
        data.hasModule = moduleChecker === 'Yes' ? true : false;
        if (data.hasModule) {
          data.moduleName = `${pascalPage}Module`;
          data.moduleFile = `${pascalPage}.module`;
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
            await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data));
            await createFile(componentUri, `${data.componentName?.toLowerCase()}.module.scss`, generateCssFile(data));

            // export module and component file
            paths.moduleFolderPath = config.modulesPath ? `${f}${config.modulesPath}` : `${f}\\src\\containers\\modules`;
            paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
            const moduleFolderUri = vscode.Uri.file(paths.moduleFolderPath);
            const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
            await exportContainers(moduleFolderUri, `export { default as ${data.moduleName} } from './${data.page}/${data.moduleFile}';`);
            await exportContainers(componentForlderUri, `export { default as ${data.componentName} } from './${data.page}/${data.componentName}';`);
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
    const data: { module?: string; moduleName?: string; moduleFile?: string; hasComponent?: boolean; componentName?: string } = {};

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

        const withComponent = await vscode.window.showInputBox({
          prompt: 'Do you want to generate a component?',
          value: 'Yes',
        });
        if (withComponent !== 'Yes') {
          data.hasComponent = false;
        } else {
          data.hasComponent = true;
        }
        if (data.hasComponent) {
          data.componentName = capitalisedModule;
        }
      } else {
        vscode.window.showInformationMessage('You canceled the input.');
      }

      const paths: { modulePath?: string; moduleFolderPath?: string; componentsFolderPath?: string; componentPath?: string } = {};
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

        if (data.hasComponent) {
          paths.componentPath = !checkIfEmptyString(config.componentsPath)
            ? `${f}${config.componentsPath}\\${data.module}`
            : `${f}\\src\\containers\\components\\${data.module}`;
          const componentUri = vscode.Uri.file(paths.componentPath);

          await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data));
          await createFile(componentUri, `${data.componentName?.toLowerCase()}.module.scss`, generateCssFile(data));
          paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
          const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
          await exportContainers(componentForlderUri, `export { default as ${data.componentName} } from './${data.module}/${data.componentName}';`);
        }
      } else {
        vscode.window.showErrorMessage('Next code generator: Working folder not found, open a folder an try again');
      }
    }
  });
  context.subscriptions.push(generateNextModuleDisposable);

  // generate component
  const generateNextComponentDisposable = vscode.commands.registerCommand('nextcodegen.generate_component', async context => {
    const config = await getConfig();
    const data: { componentName?: string; componentFolder?: string } = {};
    if (config) {
      const componentInfo = await vscode.window.showInputBox({
        prompt: 'Enter component name',
        placeHolder: 'componentname',
      });

      if (componentInfo) {
        data.componentName = capitalize(componentInfo);
        data.componentFolder = componentInfo.toLowerCase();

        const paths: { componentsFolderPath?: string; componentPath?: string } = {};
        if (vscode.workspace.workspaceFolders !== undefined) {
          let f = vscode.workspace.workspaceFolders[0].uri.fsPath;

          paths.componentPath = !checkIfEmptyString(config.componentsPath)
            ? `${f}${config.componentsPath}\\${data.componentFolder}`
            : `${f}\\src\\containers\\components\\${data.componentFolder}`;
          const componentUri = vscode.Uri.file(paths.componentPath);

          await createFile(componentUri, `${data.componentName}.tsx`, generateComponent(data));
          await createFile(componentUri, `${data.componentName?.toLowerCase()}.module.scss`, generateCssFile(data));
          paths.componentsFolderPath = config.componentsPath ? `${f}${config.componentsPath}` : `${f}\\src\\containers\\components`;
          const componentForlderUri = vscode.Uri.file(paths.componentsFolderPath);
          await exportContainers(componentForlderUri, `export { default as ${data.componentName} } from './${data.componentFolder}/${data.componentName}';`);
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
